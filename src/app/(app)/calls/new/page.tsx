import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek } from "date-fns";
import { NewCallForm } from "./new-call-form";

export const dynamic = "force-dynamic";

export default async function NewCallPage() {
  const session = await auth();
  const now = new Date();

  // Get current schedule for the logged-in user (or any current schedule)
  const currentSchedule = await prisma.schedule.findFirst({
    where: {
      weekStart: { lte: now },
      weekEnd: { gte: now },
    },
    include: { user: true },
  });

  // Get all active schedules for the dropdown
  const recentSchedules = await prisma.schedule.findMany({
    where: {
      weekStart: { lte: endOfWeek(now, { weekStartsOn: 1 }) },
      weekEnd: { gte: startOfWeek(now, { weekStartsOn: 1 }) },
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { weekStart: "desc" },
    take: 10,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">Log a Call</h1>
        <p className="text-muted-foreground">
          Record details about an on-call support incident.
        </p>
      </div>

      <NewCallForm
        currentScheduleId={currentSchedule?.id ?? null}
        schedules={recentSchedules.map((s) => ({
          id: s.id,
          weekStart: s.weekStart.toISOString(),
          userName: s.user.name ?? "Unknown",
        }))}
      />
    </div>
  );
}
