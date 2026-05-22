import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { notifySwapClaimed } from "@/lib/slack";
import { canClaimSwap, canCancelSwap } from "@/lib/auth-guard";

export const runtime = "nodejs";

// PUT /api/swaps/[id] - Claim or cancel a swap board post
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
  const { action } = body;

  if (!action || !["claim", "cancel"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'claim' or 'cancel'" },
      { status: 400 }
    );
  }

  const post = await prisma.swapPost.findUnique({
    where: { id },
    include: {
      poster: { select: { id: true, name: true, fullName: true, email: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Swap post not found" }, { status: 404 });
  }

  if (post.status !== "OPEN") {
    return NextResponse.json(
      { error: `Cannot ${action} a post that is ${post.status.toLowerCase()}` },
      { status: 400 }
    );
  }

  // ─── CANCEL ────────────────────────────────────────────────────────────────
  if (action === "cancel") {
    if (!canCancelSwap(session, { posterId: post.posterId })) {
      return NextResponse.json(
        { error: "You do not have permission to cancel this post" },
        { status: 403 }
      );
    }

    const updated = await prisma.swapPost.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  }

  // ─── CLAIM ─────────────────────────────────────────────────────────────────
  if (!canClaimSwap(session, { posterId: post.posterId })) {
    return NextResponse.json(
      { error: "You cannot claim your own post" },
      { status: 403 }
    );
  }

  const claimerId = session.user.id;
  const { offeredWeekStart, offeredDays } = body;

  // Find poster's schedule for this week
  const posterSchedule = await prisma.schedule.findFirst({
    where: {
      userId: post.posterId,
      weekStart: post.weekStart,
    },
  });

  if (!posterSchedule) {
    return NextResponse.json(
      { error: "Poster's schedule entry no longer exists" },
      { status: 400 }
    );
  }

  // ─── SWAP TYPE: validate the claimer's offered week/days ─────────────────
  let claimerSchedule: { id: string; weekStart: Date; weekEnd: Date } | null = null;
  let parsedOfferedDays: Date[] = [];

  if (post.postType === "SWAP") {
    if (!offeredWeekStart) {
      return NextResponse.json(
        { error: "offeredWeekStart is required for SWAP posts" },
        { status: 400 }
      );
    }

    const offeredWeekDate = startOfWeek(new Date(offeredWeekStart), { weekStartsOn: 1 });
    const offeredWeekEnd = endOfWeek(offeredWeekDate, { weekStartsOn: 1 });

    claimerSchedule = await prisma.schedule.findFirst({
      where: {
        userId: claimerId,
        weekStart: offeredWeekDate,
      },
    });

    if (!claimerSchedule) {
      return NextResponse.json(
        { error: "You don't have a scheduled week starting on that offered date" },
        { status: 400 }
      );
    }

    if (post.coverageType === "SPECIFIC_DAYS") {
      if (!Array.isArray(offeredDays) || offeredDays.length === 0) {
        return NextResponse.json(
          { error: "offeredDays is required for SWAP + SPECIFIC_DAYS claims" },
          { status: 400 }
        );
      }
      parsedOfferedDays = offeredDays.map((d: string) => new Date(d));
      for (const day of parsedOfferedDays) {
        if (!isWithinInterval(day, { start: offeredWeekDate, end: offeredWeekEnd })) {
          return NextResponse.json(
            { error: "All offeredDays must fall within your offered week" },
            { status: 400 }
          );
        }
      }
    }
  }

  // ─── Execute the claim in a transaction ──────────────────────────────────
  const updated = await prisma.$transaction(async (tx) => {
    // Update the post status
    const updatedPost = await tx.swapPost.update({
      where: { id },
      data: {
        status: "CLAIMED",
        claimerId,
        claimedAt: new Date(),
        offeredWeekStart: post.postType === "SWAP" ? claimerSchedule!.weekStart : null,
        offeredDays: parsedOfferedDays,
      },
    });

    // Execute the actual schedule changes
    if (post.coverageType === "FULL_WEEK") {
      // Reassign poster's schedule to claimer
      await tx.schedule.update({
        where: { id: posterSchedule.id },
        data: {
          userId: claimerId,
          isOverride: true,
          notes: `Swap board: claimed by ${session.user.name || session.user.email}`,
        },
      });

      // For SWAP: also reassign claimer's offered week to poster
      if (post.postType === "SWAP" && claimerSchedule) {
        await tx.schedule.update({
          where: { id: claimerSchedule.id },
          data: {
            userId: post.posterId,
            isOverride: true,
            notes: `Swap board: offered to ${post.poster.name || post.poster.email}`,
          },
        });
      }
    } else {
      // SPECIFIC_DAYS: create DayCoverage records
      // Claimer covers the poster's posted days
      for (const day of post.specificDays) {
        await tx.dayCoverage.create({
          data: {
            date: day,
            userId: claimerId,
            scheduleId: posterSchedule.id,
            swapPostId: id,
          },
        });
      }

      // For SWAP: poster covers the claimer's offered days
      if (post.postType === "SWAP" && claimerSchedule) {
        for (const day of parsedOfferedDays) {
          await tx.dayCoverage.create({
            data: {
              date: day,
              userId: post.posterId,
              scheduleId: claimerSchedule.id,
              swapPostId: id,
            },
          });
        }
      }
    }

    return updatedPost;
  });

  // Slack notification
  await notifySwapClaimed(
    session.user.name || "Unknown",
    post.poster.fullName || post.poster.name || "Unknown",
    post.weekStart.toLocaleDateString(),
    post.postType
  );

  return NextResponse.json(updated);
}
