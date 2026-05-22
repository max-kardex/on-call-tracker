import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek } from "date-fns";

 

// PUT /api/swaps/[id] - Approve or reject a swap
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
  const { action, responseNote } = body;

  if (!action || !["approve", "reject", "cancel"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'approve', 'reject', or 'cancel'" },
      { status: 400 }
    );
  }

  const swap = await prisma.swapRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      target: true,
    },
  });

  if (!swap) {
    return NextResponse.json({ error: "Swap request not found" }, { status: 404 });
  }

  // Only the target can approve/reject, only the requester can cancel
  if (action === "cancel" && swap.requesterId !== session.user.id) {
    return NextResponse.json({ error: "Only the requester can cancel" }, { status: 403 });
  }
  if ((action === "approve" || action === "reject") && swap.targetId !== session.user.id) {
    return NextResponse.json({ error: "Only the target can approve or reject" }, { status: 403 });
  }

  const statusMap: Record<string, "APPROVED" | "REJECTED" | "CANCELLED"> = {
    approve: "APPROVED",
    reject: "REJECTED",
    cancel: "CANCELLED",
  };

  const updatedSwap = await prisma.swapRequest.update({
    where: { id },
    data: {
      status: statusMap[action],
      responseNote: responseNote || null,
      respondedAt: new Date(),
    },
  });

  // If approved, swap the schedules
  if (action === "approve") {
    await performScheduleSwap(swap);
  }

  return NextResponse.json(updatedSwap);
}

async function performScheduleSwap(swap: {
  requesterId: string;
  targetId: string;
  originalWeekStart: Date;
  swapType: string;
}) {
  const weekStart = startOfWeek(swap.originalWeekStart, { weekStartsOn: 1 });

  if (swap.swapType === "FULL_WEEK") {
    // Find the requester's schedule for this week
    const requesterSchedule = await prisma.schedule.findFirst({
      where: {
        userId: swap.requesterId,
        weekStart,
      },
    });

    if (requesterSchedule) {
      // Assign the target to this week instead
      await prisma.schedule.update({
        where: { id: requesterSchedule.id },
        data: {
          userId: swap.targetId,
          isOverride: true,
          notes: `Swapped from ${swap.requesterId}`,
        },
      });
    }

    // Find if target has a schedule that week and swap it to requester
    const targetSchedule = await prisma.schedule.findFirst({
      where: {
        userId: swap.targetId,
        weekStart,
      },
    });

    if (targetSchedule) {
      await prisma.schedule.update({
        where: { id: targetSchedule.id },
        data: {
          userId: swap.requesterId,
          isOverride: true,
          notes: `Swapped from ${swap.targetId}`,
        },
      });
    }
  }
}
