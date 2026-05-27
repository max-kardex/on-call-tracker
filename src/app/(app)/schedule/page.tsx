import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, addWeeks, endOfWeek } from "date-fns";
import { toDateString } from "@/lib/date-utils";
import { ScheduleCalendar } from "./schedule-calendar";
import { ScheduleMonthCalendar } from "./schedule-month-calendar";
import { ScheduleViewToggle } from "./schedule-view-toggle";
import { GenerateRotationForm } from "./generate-rotation-form";
import { hasAnyRole } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await auth();
  const currentUserId = (session?.user as any)?.id as string;

  // Current Monday (start of this week)
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = addWeeks(start, 12);

  // Fetch upcoming schedules (this week + next 12 weeks)
  const upcomingSchedules = await prisma.schedule.findMany({
    where: {
      weekStart: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, name: true, fullName: true, email: true, image: true } },
    },
    orderBy: { weekStart: "asc" },
  });

  // Fetch all past schedules (weekEnd before this Monday)
  const pastSchedulesRaw = await prisma.schedule.findMany({
    where: {
      weekEnd: { lt: start },
    },
    include: {
      user: { select: { id: true, name: true, fullName: true, email: true, image: true } },
    },
    orderBy: { weekStart: "desc" },
  });

  const engineers = await prisma.user.findMany({
    where: { isActive: true, roles: { has: "ENGINEER" } },
    select: { id: true, name: true, fullName: true, email: true, image: true },
    orderBy: { name: "asc" },
  });

  const canManage = hasAnyRole(session, ["ADMIN", "MANAGER"]);

  // Identify engineers who have self-assigned in the upcoming window (they'll be deprioritized)
  const selfAssignedIds = [...new Set(
    upcomingSchedules.filter((s) => s.isSelfAssigned).map((s) => s.userId)
  )];

  // Serialize dates as YYYY-MM-DD to avoid timezone issues on the client
  const serializedSchedules = upcomingSchedules.map((s) => ({
    id: s.id,
    weekStart: toDateString(s.weekStart),
    weekEnd: toDateString(s.weekEnd),
    isOverride: s.isOverride,
    isSelfAssigned: s.isSelfAssigned,
    notes: s.notes,
    user: s.user,
  }));

  const serializedPastSchedules = pastSchedulesRaw.map((s) => ({
    id: s.id,
    weekStart: toDateString(s.weekStart),
    weekEnd: toDateString(s.weekEnd),
    isOverride: s.isOverride,
    isSelfAssigned: s.isSelfAssigned,
    notes: s.notes,
    user: s.user,
  }));

  // Compute all 12 Monday dates and find which are open (unassigned)
  const assignedWeekStarts = new Set(
    serializedSchedules.map((s) => s.weekStart)
  );

  const openWeeks: { weekStart: string; weekEnd: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const monday = addWeeks(start, i);
    const mondayStr = toDateString(monday);
    if (!assignedWeekStarts.has(mondayStr)) {
      const sunday = endOfWeek(monday, { weekStartsOn: 1 });
      openWeeks.push({
        weekStart: mondayStr,
        weekEnd: toDateString(sunday),
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            On-call rotation schedule
          </p>
        </div>
        {canManage && <GenerateRotationForm engineers={engineers} deprioritizedIds={selfAssignedIds} />}
      </div>

      <ScheduleViewToggle
        calendarView={
          <ScheduleMonthCalendar
            openWeeks={openWeeks}
            currentUserId={currentUserId}
          />
        }
        listView={
          <ScheduleCalendar
            schedules={serializedSchedules}
            pastSchedules={serializedPastSchedules}
            engineers={engineers}
            isAdmin={canManage}
            openWeeks={openWeeks}
            currentUserId={currentUserId}
          />
        }
      />
    </div>
  );
}
