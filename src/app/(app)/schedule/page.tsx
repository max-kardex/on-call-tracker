import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, addWeeks } from "date-fns";
import { ScheduleCalendar } from "./schedule-calendar";
import { ScheduleMonthCalendar } from "./schedule-month-calendar";
import { ScheduleViewToggle } from "./schedule-view-toggle";
import { GenerateRotationForm } from "./generate-rotation-form";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await auth();
  const currentUserId = (session?.user as any)?.id as string;

  // Fetch schedules for next 12 weeks
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = addWeeks(start, 12);

  const schedules = await prisma.schedule.findMany({
    where: {
      weekStart: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { weekStart: "asc" },
  });

  const engineers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });

  const isAdmin = (session?.user as Record<string, unknown>)?.role === "ADMIN";

  const serializedSchedules = schedules.map((s) => ({
    id: s.id,
    weekStart: s.weekStart.toISOString(),
    weekEnd: s.weekEnd.toISOString(),
    isOverride: s.isOverride,
    isSelfAssigned: s.isSelfAssigned,
    notes: s.notes,
    user: s.user,
  }));

  // Compute all 12 Monday dates and find which are open (unassigned)
  const assignedWeekStarts = new Set(
    serializedSchedules.map((s) => s.weekStart)
  );

  const openWeeks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const monday = addWeeks(start, i);
    const mondayIso = monday.toISOString();
    if (!assignedWeekStarts.has(mondayIso)) {
      openWeeks.push(mondayIso);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            Weekly on-call rotation for the next 12 weeks
          </p>
        </div>
        {isAdmin && <GenerateRotationForm engineers={engineers} />}
      </div>

      <ScheduleViewToggle
        calendarView={
          <ScheduleMonthCalendar
            schedules={serializedSchedules}
            openWeeks={openWeeks}
            currentUserId={currentUserId}
          />
        }
        listView={
          <ScheduleCalendar
            schedules={serializedSchedules}
            engineers={engineers}
            isAdmin={isAdmin}
            openWeeks={openWeeks}
            currentUserId={currentUserId}
          />
        }
      />
    </div>
  );
}
