import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek } from "date-fns";
import { NewSwapPostForm } from "./new-swap-form";

export const dynamic = "force-dynamic";

export default async function NewSwapPage() {
  const session = await auth();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Get current user's upcoming schedules (the only weeks they can post)
  const mySchedules = await prisma.schedule.findMany({
    where: {
      userId: session?.user?.id,
      weekStart: { gte: weekStart },
    },
    orderBy: { weekStart: "asc" },
    take: 24,
    select: { id: true, weekStart: true, weekEnd: true },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">New Swap Post</h1>
        <p className="text-muted-foreground">
          Post a week (or specific days) for someone else to take or trade.
        </p>
      </div>

      <NewSwapPostForm
        mySchedules={mySchedules.map((s) => ({
          id: s.id,
          weekStart: s.weekStart.toISOString(),
          weekEnd: s.weekEnd.toISOString(),
        }))}
      />
    </div>
  );
}
