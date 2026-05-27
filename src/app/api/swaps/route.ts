import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { notifySwapPost } from "@/lib/slack";
import { notifySwapPosted } from "@/lib/notifications";
import { canCreateSwap } from "@/lib/auth-guard";

export const runtime = "nodejs";

// GET /api/swaps - List swap board posts
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
    where.OR = [{ posterId: userId }, { claimerId: userId }];
  }

  const posts = await prisma.swapPost.findMany({
    where,
    include: {
      poster: { select: { id: true, name: true, fullName: true, email: true, image: true } },
      claimer: { select: { id: true, name: true, fullName: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(posts);
}

// POST /api/swaps - Create a swap board post
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canCreateSwap(session)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { postType, coverageType, weekStart, specificDays, reason } = body;

  // Validation
  if (!postType || !coverageType || !weekStart) {
    return NextResponse.json(
      { error: "Missing required fields: postType, coverageType, weekStart" },
      { status: 400 }
    );
  }

  if (!["GIVE_AWAY", "SWAP"].includes(postType)) {
    return NextResponse.json({ error: "Invalid postType" }, { status: 400 });
  }

  if (!["FULL_WEEK", "SPECIFIC_DAYS"].includes(coverageType)) {
    return NextResponse.json({ error: "Invalid coverageType" }, { status: 400 });
  }

  const weekStartDate = new Date(weekStart + "T12:00:00");
  const weekStartNormalized = startOfWeek(weekStartDate, { weekStartsOn: 1 });
  const weekEndNormalized = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  // Poster must have a Schedule entry for that week
  const posterSchedule = await prisma.schedule.findFirst({
    where: {
      userId: session.user.id,
      weekStart: weekStartNormalized,
    },
  });

  if (!posterSchedule) {
    return NextResponse.json(
      { error: "You don't have a scheduled week starting on that date" },
      { status: 400 }
    );
  }

  // For SPECIFIC_DAYS: validate days fall within the week
  let parsedDays: Date[] = [];
  if (coverageType === "SPECIFIC_DAYS") {
    if (!Array.isArray(specificDays) || specificDays.length === 0) {
      return NextResponse.json(
        { error: "specificDays is required for SPECIFIC_DAYS coverage" },
        { status: 400 }
      );
    }
    parsedDays = specificDays.map((d: string) =>
      typeof d === "string" && d.length === 10 ? new Date(d + "T12:00:00") : new Date(d)
    );
    for (const day of parsedDays) {
      if (!isWithinInterval(day, { start: weekStartNormalized, end: weekEndNormalized })) {
        return NextResponse.json(
          { error: "All specificDays must fall within the posted week" },
          { status: 400 }
        );
      }
    }
  }

  const post = await prisma.swapPost.create({
    data: {
      posterId: session.user.id,
      postType,
      coverageType,
      weekStart: weekStartNormalized,
      specificDays: parsedDays,
      reason: reason || null,
    },
    include: {
      poster: { select: { id: true, name: true, fullName: true, email: true } },
    },
  });

  // Slack notification
  const daysDescription =
    coverageType === "SPECIFIC_DAYS"
      ? parsedDays
          .map((d) =>
            d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          )
          .join(", ")
      : undefined;

  await notifySwapPost(
    post.poster.fullName || post.poster.name || "Unknown",
    weekStartNormalized.toLocaleDateString(),
    postType,
    coverageType,
    daysDescription
  );

  // In-app notification for all engineers
  await notifySwapPosted(
    session.user.id,
    post.poster.fullName || post.poster.name || "Unknown",
    weekStartNormalized.toLocaleDateString(),
    postType,
    coverageType
  );

  return NextResponse.json(post, { status: 201 });
}
