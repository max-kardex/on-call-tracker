import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyHighSeverityCall } from "@/lib/slack";

 

// GET /api/calls - List call logs
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const severity = searchParams.get("severity");
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};
  if (severity) where.severity = severity;
  if (userId) where.userId = userId;
  if (from || to) {
    where.startTime = {};
    if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
    if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
  }

  const [calls, total] = await Promise.all([
    prisma.callLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        schedule: { select: { id: true, weekStart: true } },
      },
      orderBy: { startTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.callLog.count({ where }),
  ]);

  return NextResponse.json({
    calls,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/calls - Create a call log
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { scheduleId, severity, title, description, startTime, endTime, resolution } = body;

  if (!scheduleId || !severity || !title || !startTime) {
    return NextResponse.json(
      { error: "Missing required fields: scheduleId, severity, title, startTime" },
      { status: 400 }
    );
  }

  // Calculate duration if both start and end provided
  let duration: number | null = null;
  if (startTime && endTime) {
    duration = Math.round(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
    );
  }

  const call = await prisma.callLog.create({
    data: {
      scheduleId,
      userId: session.user.id,
      severity,
      title,
      description: description || null,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      duration,
      resolution: resolution || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // Notify on high severity
  if (severity === "P1" || severity === "P2") {
    await notifyHighSeverityCall(
      call.user.name ?? "Unknown",
      severity,
      title
    );
  }

  return NextResponse.json(call, { status: 201 });
}
