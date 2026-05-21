import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/calls/[id] - Get a single call
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const call = await prisma.callLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      schedule: { select: { id: true, weekStart: true, weekEnd: true } },
    },
  });

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  return NextResponse.json(call);
}

// PUT /api/calls/[id] - Update a call
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { severity, title, description, startTime, endTime, resolution } = body;

  // Recalculate duration if times changed
  let duration: number | undefined;
  if (startTime && endTime) {
    duration = Math.round(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
    );
  }

  const call = await prisma.callLog.update({
    where: { id },
    data: {
      ...(severity && { severity }),
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      ...(duration !== undefined && { duration }),
      ...(resolution !== undefined && { resolution }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(call);
}

// DELETE /api/calls/[id] - Delete a call
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.callLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
