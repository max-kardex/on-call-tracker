import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addWeeks, startOfWeek, endOfWeek } from "date-fns";

// GET /api/schedule - List schedules
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from) where.weekStart = { gte: new Date(from) };
  if (to) {
    where.weekEnd = { ...(where.weekEnd as object || {}), lte: new Date(to) };
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { weekStart: "asc" },
  });

  return NextResponse.json(schedules);
}

// POST /api/schedule - Generate rotation or create single entry
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "generate") {
    return handleGenerateRotation(body);
  } else {
    return handleCreateEntry(body);
  }
}

async function handleGenerateRotation(body: {
  startDate: string;
  weeks: number;
  engineerIds?: string[];
}) {
  const { startDate, weeks } = body;
  let { engineerIds } = body;

  // If no specific engineers provided, use all active engineers
  if (!engineerIds || engineerIds.length === 0) {
    const engineers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    engineerIds = engineers.map((e) => e.id);
  }

  if (engineerIds.length === 0) {
    return NextResponse.json(
      { error: "No engineers available for rotation" },
      { status: 400 }
    );
  }

  // Find the last scheduled person to continue rotation from where we left off
  const lastSchedule = await prisma.schedule.findFirst({
    orderBy: { weekStart: "desc" },
  });

  let startIndex = 0;
  if (lastSchedule) {
    const lastEngineerIndex = engineerIds.indexOf(lastSchedule.userId);
    if (lastEngineerIndex !== -1) {
      startIndex = (lastEngineerIndex + 1) % engineerIds.length;
    }
  }

  const schedules = [];
  const baseDate = startOfWeek(new Date(startDate), { weekStartsOn: 1 });

  for (let i = 0; i < weeks; i++) {
    const weekStartDate = addWeeks(baseDate, i);
    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
    const engineerIndex = (startIndex + i) % engineerIds.length;

    schedules.push({
      userId: engineerIds[engineerIndex],
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      isOverride: false,
    });
  }

  // Upsert schedules (skip existing weeks for the same user)
  const created = [];
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
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      created.push(result);
    } catch {
      // Skip conflicts (e.g., another engineer already assigned to that week)
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
  const weekStartDate = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      isOverride: true,
      notes,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(schedule);
}

// PUT /api/schedule - Update a schedule entry
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, userId, notes } = body;

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      ...(userId && { userId }),
      ...(notes !== undefined && { notes }),
      isOverride: true,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
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

  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
