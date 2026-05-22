import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addWeeks, startOfWeek } from "date-fns";
import { NewSwapForm } from "./new-swap-form";

export const dynamic = "force-dynamic";

export default async function NewSwapPage() {
  const session = await auth();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  // Get current user's upcoming schedules
  const mySchedules = await prisma.schedule.findMany({
    where: {
      userId: session?.user?.id,
      weekStart: { gte: weekStart },
    },
    orderBy: { weekStart: "asc" },
    take: 12,
  });

  // Get other engineers
  const engineers = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: session?.user?.id },
    },
    select: { id: true, name: true, fullName: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">Request a Swap</h1>
        <p className="text-muted-foreground">
          Ask another engineer to cover your on-call shift.
        </p>
      </div>

      <NewSwapForm
        mySchedules={mySchedules.map((s) => ({
          id: s.id,
          weekStart: s.weekStart.toISOString(),
          weekEnd: s.weekEnd.toISOString(),
        }))}
        engineers={engineers}
      />
    </div>
  );
}
