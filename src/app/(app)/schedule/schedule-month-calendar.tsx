"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScheduleEntry {
  id: string;
  weekStart: string;
  weekEnd: string;
  isOverride: boolean;
  notes: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Props {
  schedules: ScheduleEntry[];
}

// Each entry has both light + dark compatible classes in a single string
const ENGINEER_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
  "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
  "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30",
  "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
  "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
  "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
  "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30",
  "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30",
  "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-500/20 dark:text-lime-300 dark:border-lime-500/30",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30",
  "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30",
];

export function ScheduleMonthCalendar({ schedules }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Build a color map for engineers based on order of appearance
  const engineerColorMap = useMemo(() => {
    const map = new Map<string, number>();
    schedules.forEach((s) => {
      if (!map.has(s.user.id)) {
        map.set(s.user.id, map.size % ENGINEER_COLORS.length);
      }
    });
    return map;
  }, [schedules]);

  // Get all days to display in the calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Find which schedule covers a given day
  function getScheduleForDay(day: Date): ScheduleEntry | undefined {
    return schedules.find((s) =>
      isWithinInterval(day, {
        start: parseISO(s.weekStart),
        end: parseISO(s.weekEnd),
      })
    );
  }

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(new Date())}
        >
          Today
        </Button>
      </CardHeader>
      <CardContent>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {weekdays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {calendarDays.map((day) => {
            const schedule = getScheduleForDay(day);
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const colorIdx = schedule
              ? engineerColorMap.get(schedule.user.id) ?? 0
              : 0;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[72px] p-1.5 bg-background flex flex-col",
                  !inMonth && "opacity-40"
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    today && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Schedule indicator */}
                {schedule && (
                  <div
                    className={cn(
                      "mt-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate",
                      ENGINEER_COLORS[colorIdx]
                    )}
                    title={`${schedule.user.name ?? schedule.user.email}${schedule.isOverride ? " (override)" : ""}`}
                  >
                    {schedule.user.name?.split(" ")[0] ?? schedule.user.email?.split("@")[0]}
                    {schedule.isOverride && " *"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {engineerColorMap.size > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from(engineerColorMap.entries()).map(([userId, colorIdx]) => {
              const engineer = schedules.find((s) => s.user.id === userId)?.user;
              if (!engineer) return null;
              return (
                <div
                  key={userId}
                  className={cn(
                    "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                    ENGINEER_COLORS[colorIdx]
                  )}
                >
                  {engineer.name ?? engineer.email}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
