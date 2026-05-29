import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/schedule/calendar.ics?token=<TOKEN>
 *
 * Public ICS calendar feed for on-call schedules.
 * Authenticated via a shared token (no login required).
 * Returns individual all-day events per day showing who's on-call.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse("Missing token parameter", { status: 401 });
  }

  // Validate token
  const calendarToken = await prisma.calendarToken.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!calendarToken || calendarToken.token !== token) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  // Query schedules: past 4 weeks + all future
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  fourWeeksAgo.setHours(0, 0, 0, 0);

  const schedules = await prisma.schedule.findMany({
    where: {
      weekStart: { gte: fourWeeksAgo },
    },
    include: {
      user: { select: { fullName: true, name: true } },
      dayCoverages: {
        include: {
          user: { select: { fullName: true, name: true } },
        },
      },
    },
    orderBy: { weekStart: "asc" },
  });

  // Build ICS events
  const events: string[] = [];

  for (const schedule of schedules) {
    const assigneeName = schedule.user.fullName || schedule.user.name || "Unknown";
    const weekStartDate = new Date(schedule.weekStart);

    // Build a map of day coverages for this schedule
    const coverageMap = new Map<string, string>();
    for (const coverage of schedule.dayCoverages) {
      const dateKey = formatDateKey(new Date(coverage.date));
      const coverName = coverage.user.fullName || coverage.user.name || "Unknown";
      coverageMap.set(dateKey, coverName);
    }

    // Generate 7 individual day events (Mon-Sun)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + dayOffset);

      const dateKey = formatDateKey(dayDate);
      const onCallName = coverageMap.get(dateKey) || assigneeName;

      const dtStart = formatIcsDate(dayDate);
      const nextDay = new Date(dayDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const dtEnd = formatIcsDate(nextDay);

      const uid = `${schedule.id}-${dateKey}@oncall-tracker`;
      const weekLabel = weekStartDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTART;VALUE=DATE:${dtStart}`,
          `DTEND;VALUE=DATE:${dtEnd}`,
          `SUMMARY:On-Call: ${escapeIcsText(onCallName)}`,
          `DESCRIPTION:On-call rotation week of ${weekLabel}`,
          "TRANSP:TRANSPARENT",
          "END:VEVENT",
        ].join("\r\n")
      );
    }
  }

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//On-Call Tracker//EN",
    "X-WR-CALNAME:On-Call Schedule",
    "X-WR-TIMEZONE:America/New_York",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="oncall-schedule.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

/**
 * Format a Date to YYYYMMDD for ICS DATE values.
 */
function formatIcsDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Format a Date to YYYY-MM-DD for keying day coverages.
 */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Escape text for ICS properties (commas, semicolons, backslashes, newlines).
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
