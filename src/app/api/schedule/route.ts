import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addWeeks, startOfWeek, endOfWeek, isBefore, startOfDay } from "date-fns";
import { notifyVolunteer } from "@/lib/slack";
import { hasAnyRole, canSelfAssign, canManageSchedule } from "@/lib/auth-guard";

export const runtime = "nodejs";

// GET /api/schedule - List schedules
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Overlap-based filtering: a schedule is included if its range overlaps the query range
  // (weekStart <= to AND weekEnd >= from)
  const where: Record<string, unknown> = {};
  if (from && to) {
    where.weekStart = { lte: new Date(to) };
    where.weekEnd = { gte: new Date(from) };
  } else if (from) {
    where.weekEnd = { gte: new Date(from) };
  } else if (to) {
    where.weekStart = { lte: new Date(to) };
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, fullName: true, email: true, image: true } },
      dayCoverages: {
        include: {
          user: { select: { id: true, name: true, fullName: true, email: true, image: true } },
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { weekStart: "asc" },
  });

  return NextResponse.json(schedules);
}

// POST /api/schedule - Generate rotation, create single entry, or self-assign
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "generate") {
    // Only MANAGER or ADMIN can generate rotations
    if (!canManageSchedule(session)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }
    return handleGenerateRotation(body);
  } else if (action === "self-assign") {
    // Only ENGINEER or ADMIN can self-assign
    if (!canSelfAssign(session)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }
    return handleSelfAssign(session, body);
  } else {
    // Create entry for others - only MANAGER or ADMIN
    if (!canManageSchedule(session)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }
    return handleCreateEntry(body);
  }
}

async function handleSelfAssign(
  session: any,
  body: { weekStart: string; notes?: string }
) {
  const { weekStart, notes } = body;
  const userId = (session.user as any).id;

  if (!userId) {
    return NextResponse.json({ error: "User ID not found" }, { status: 400 });
  }

  const weekStartDate = startOfWeek(new Date(weekStart + "T12:00:00"), { weekStartsOn: 1 });
  const today = startOfDay(new Date());

  // Validate: must be a future week
  if (isBefore(weekStartDate, today)) {
    return NextResponse.json(
      { error: "Cannot self-assign to a past week" },
      { status: 400 }
    );
  }

  // Validate: week must not already be assigned to anyone
  const existing = await prisma.schedule.findFirst({
    where: { weekStart: weekStartDate },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This week is already assigned" },
      { status: 409 }
    );
  }

  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      isOverride: false,
      isSelfAssigned: true,
      notes,
    },
    include: { user: { select: { id: true, name: true, fullName: true, email: true, image: true } } },
  });

  // Send Slack notification
  const engineerName = schedule.user.fullName || schedule.user.name || schedule.user.email || "Someone";
  const weekLabel = weekStartDate.toISOString().split("T")[0];
  try {
    await notifyVolunteer(engineerName, weekLabel);
  } catch {
    // Don't fail the request if Slack notification fails
  }

  return NextResponse.json(schedule);
}

async function handleGenerateRotation(body: {
  startDate: string;
  weeks: number;
  engineerIds?: string[];
}) {
  const { startDate, weeks } = body;
  let { engineerIds } = body;

  // If no specific engineers provided, use all active users with ENGINEER role
  if (!engineerIds || engineerIds.length === 0) {
    const engineers = await prisma.user.findMany({
      where: { isActive: true, roles: { has: "ENGINEER" } },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    engineerIds = engineers.map((e) => e.id);
  }

  if (!engineerIds || engineerIds.length === 0) {
    return NextResponse.json(
      { error: "No engineers available for rotation" },
      { status: 400 }
    );
  }

  const baseDate = startOfWeek(new Date(startDate + "T12:00:00"), { weekStartsOn: 1 });
  const windowEnd = addWeeks(baseDate, weeks);

  // Find existing entries in this generation window (including self-assigned)
  const existingEntries = await prisma.schedule.findMany({
    where: {
      weekStart: { gte: baseDate, lt: windowEnd },
    },
    select: { weekStart: true, userId: true, isSelfAssigned: true },
  });

  // Identify weeks that are already assigned (skip these)
  const assignedWeekStarts = new Set(
    existingEntries.map((e) => e.weekStart.toISOString())
  );

  // Identify engineers who self-assigned in this window (deprioritize them)
  const selfAssignedEngineerIds = new Set(
    existingEntries
      .filter((e) => e.isSelfAssigned)
      .map((e) => e.userId)
  );

  // Build prioritized rotation order: non-self-assigned first, self-assigned last
  const regularPool = engineerIds.filter((id) => !selfAssignedEngineerIds.has(id));
  const deprioritizedPool = engineerIds.filter((id) => selfAssignedEngineerIds.has(id));
  const rotationOrder = [...regularPool, ...deprioritizedPool];

  if (rotationOrder.length === 0) {
    return NextResponse.json(
      { error: "No engineers available for rotation" },
      { status: 400 }
    );
  }

  // Find the last scheduled person to continue rotation from where we left off
  const lastSchedule = await prisma.schedule.findFirst({
    where: {
      weekStart: { lt: baseDate },
    },
    orderBy: { weekStart: "desc" },
  });

  let startIndex = 0;
  if (lastSchedule) {
    const lastEngineerIndex = rotationOrder.indexOf(lastSchedule.userId);
    if (lastEngineerIndex !== -1) {
      startIndex = (lastEngineerIndex + 1) % rotationOrder.length;
    }
  }

  // Build schedule entries only for open weeks
  const schedules: any[] = [];
  let rotationIdx = startIndex;

  for (let i = 0; i < weeks; i++) {
    const weekStartDate = addWeeks(baseDate, i);

    // Skip weeks that are already assigned
    if (assignedWeekStarts.has(weekStartDate.toISOString())) {
      continue;
    }

    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
    const engineerId = rotationOrder[rotationIdx % rotationOrder.length];

    schedules.push({
      userId: engineerId,
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      isOverride: false,
      isSelfAssigned: false,
    });

    rotationIdx++;
  }

  // Upsert schedules
  const created: any[] = [];
  for (const schedule of schedules) {
    try {
      const result = await prisma.schedule.upsert({
        where: {
          userId_weekStart: {
            userId: schedule.userId,
            weekStart: schedule.weekStart,
          },
        },
        update: {},
        create: schedule,
        include: { user: { select: { id: true, name: true, fullName: true, email: true } } },
      });
      created.push(result);
    } catch {
      // Skip conflicts
      continue;
    }
  }

  return NextResponse.json({ created, count: created.length });
}

async function handleCreateEntry(body: {
  userId: string;
  weekStart: string;
  notes?: string;
}) {
  const { userId, weekStart, notes } = body;
  const weekStartDate = startOfWeek(new Date(weekStart + "T12:00:00"), { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      isOverride: true,
      isSelfAssigned: false,
      notes,
    },
    include: { user: { select: { id: true, name: true, fullName: true, email: true } } },
  });

  return NextResponse.json(schedule);
}

// PUT /api/schedule - Update a schedule entry
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only MANAGER or ADMIN can update schedule entries
  if (!canManageSchedule(session)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { id, userId, notes } = body;

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      ...(userId && { userId }),
      ...(notes !== undefined && { notes }),
      isOverride: true,
      isSelfAssigned: false, // Override clears self-assigned status
    },
    include: { user: { select: { id: true, name: true, fullName: true, email: true } } },
  });

  return NextResponse.json(schedule);
}

// DELETE /api/schedule - Delete a schedule entry
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const userId = session.user.id;

  // MANAGER or ADMIN can delete any entry
  if (canManageSchedule(session)) {
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  // Only ENGINEER or ADMIN can delete their own self-assigned entries
  if (!canSelfAssign(session)) {
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }

  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (schedule.userId !== userId || !schedule.isSelfAssigned) {
    return NextResponse.json(
      { error: "You can only withdraw your own self-assigned weeks" },
      { status: 403 }
    );
  }

  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
