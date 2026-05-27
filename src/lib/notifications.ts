import { prisma } from "@/lib/prisma";

/**
 * Create in-app notifications for swap posts.
 * Notifies all active engineers except the poster.
 */
export async function notifySwapPosted(
  posterId: string,
  posterName: string,
  weekStart: string,
  postType: "GIVE_AWAY" | "SWAP",
  coverageType: "FULL_WEEK" | "SPECIFIC_DAYS"
) {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, id: { not: posterId }, roles: { has: "ENGINEER" } },
      select: { id: true },
    });

    if (users.length === 0) return;

    const action = postType === "GIVE_AWAY" ? "is giving away" : "wants to swap";
    const scope = coverageType === "FULL_WEEK" ? `the week of ${weekStart}` : `days in the week of ${weekStart}`;

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: "SWAP_POSTED" as const,
        title: "New Swap Post",
        message: `${posterName} ${action} ${scope}. Check the swap board to claim it.`,
        metadata: { weekStart, postType, coverageType },
      })),
    });
  } catch (error) {
    console.error("Failed to create swap notifications:", error);
  }
}

/**
 * Create in-app notifications when compensation rules are updated.
 * Notifies all active users.
 */
export async function notifyCompensationUpdated(adminName: string) {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (users.length === 0) return;

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: "COMPENSATION_UPDATED" as const,
        title: "Compensation Rules Updated",
        message: `${adminName} updated the compensation rules. Check the guide for the latest rates.`,
        metadata: {},
      })),
    });
  } catch (error) {
    console.error("Failed to create compensation notifications:", error);
  }
}

/**
 * Create in-app notification when an engineer is assigned to a week.
 * Notifies the assigned user.
 */
export async function notifyWeekAssigned(
  userId: string,
  weekStart: string,
  assignedBy?: string
) {
  try {
    const source = assignedBy ? `You were assigned by ${assignedBy}` : "You have been assigned";

    await prisma.notification.create({
      data: {
        userId,
        type: "WEEK_ASSIGNED" as const,
        title: "On-Call Week Assigned",
        message: `${source} for on-call duty the week of ${weekStart}.`,
        metadata: { weekStart },
      },
    });
  } catch (error) {
    console.error("Failed to create week assignment notification:", error);
  }
}
