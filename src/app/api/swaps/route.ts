import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifySwapRequest } from "@/lib/slack";

 

// GET /api/swaps - List swap requests
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (userId) {
    where.OR = [{ requesterId: userId }, { targetId: userId }];
  }

  const swaps = await prisma.swapRequest.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, email: true, image: true } },
      target: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(swaps);
}

// POST /api/swaps - Create a swap request
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { targetId, swapType, originalWeekStart, specificDays, reason } = body;

  if (!targetId || !swapType || !originalWeekStart) {
    return NextResponse.json(
      { error: "Missing required fields: targetId, swapType, originalWeekStart" },
      { status: 400 }
    );
  }

  if (targetId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot swap with yourself" },
      { status: 400 }
    );
  }

  const swap = await prisma.swapRequest.create({
    data: {
      requesterId: session.user.id,
      targetId,
      swapType,
      originalWeekStart: new Date(originalWeekStart),
      specificDays: specificDays?.map((d: string) => new Date(d)) ?? [],
      reason: reason || null,
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true } },
    },
  });

  // Send Slack notification
  await notifySwapRequest(
    swap.requester.name ?? "Unknown",
    swap.target.name ?? "Unknown",
    new Date(originalWeekStart).toLocaleDateString()
  );

  return NextResponse.json(swap, { status: 201 });
}
