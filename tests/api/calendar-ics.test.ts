import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/schedule/calendar.ics/route";
import { mockPrisma } from "../setup";

describe("GET /api/schedule/calendar.ics", () => {
  it("returns 401 when no token is provided", async () => {
    const req = new NextRequest("http://localhost/api/schedule/calendar.ics");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain("Missing token");
  });

  it("returns 401 when token is invalid", async () => {
    mockPrisma.calendarToken.findFirst.mockResolvedValue({
      id: "ct1",
      token: "abcdef1234567890abcdef1234567890",
      createdAt: new Date(),
    });

    const req = new NextRequest("http://localhost/api/schedule/calendar.ics?token=wrongtoken");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain("Invalid token");
  });

  it("returns 401 when no token exists in DB", async () => {
    mockPrisma.calendarToken.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/schedule/calendar.ics?token=sometoken");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns valid ICS with correct content-type when token is valid", async () => {
    const validToken = "abcdef1234567890abcdef1234567890";
    mockPrisma.calendarToken.findFirst.mockResolvedValue({
      id: "ct1",
      token: validToken,
      createdAt: new Date(),
    });
    mockPrisma.schedule.findMany.mockResolvedValue([]);

    const req = new NextRequest(
      `http://localhost/api/schedule/calendar.ics?token=${validToken}`
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");

    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("END:VCALENDAR");
    expect(text).toContain("X-WR-CALNAME:On-Call Schedule");
  });

  it("generates individual day events for each schedule entry", async () => {
    const validToken = "abcdef1234567890abcdef1234567890";
    mockPrisma.calendarToken.findFirst.mockResolvedValue({
      id: "ct1",
      token: validToken,
      createdAt: new Date(),
    });

    mockPrisma.schedule.findMany.mockResolvedValue([
      {
        id: "sched1",
        weekStart: new Date("2026-06-08T12:00:00"), // Monday
        weekEnd: new Date("2026-06-14T12:00:00"),
        user: { fullName: "John Smith", name: "jsmith" },
        dayCoverages: [],
      },
    ]);

    const req = new NextRequest(
      `http://localhost/api/schedule/calendar.ics?token=${validToken}`
    );
    const res = await GET(req);
    const text = await res.text();

    // Should have 7 VEVENTs for each day of the week
    const eventCount = (text.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(7);

    // Should show the assignee name
    expect(text).toContain("SUMMARY:On-Call: John Smith");

    // Should have date-based UIDs
    expect(text).toContain("UID:sched1-2026-06-08@oncall-tracker");
    expect(text).toContain("UID:sched1-2026-06-14@oncall-tracker");
  });

  it("shows covering person for days with DayCoverage entries", async () => {
    const validToken = "abcdef1234567890abcdef1234567890";
    mockPrisma.calendarToken.findFirst.mockResolvedValue({
      id: "ct1",
      token: validToken,
      createdAt: new Date(),
    });

    mockPrisma.schedule.findMany.mockResolvedValue([
      {
        id: "sched2",
        weekStart: new Date("2026-06-08T12:00:00"),
        weekEnd: new Date("2026-06-14T12:00:00"),
        user: { fullName: "Alice", name: "alice" },
        dayCoverages: [
          {
            date: new Date("2026-06-10T12:00:00"), // Wednesday
            user: { fullName: "Bob", name: "bob" },
          },
        ],
      },
    ]);

    const req = new NextRequest(
      `http://localhost/api/schedule/calendar.ics?token=${validToken}`
    );
    const res = await GET(req);
    const text = await res.text();

    // Wednesday should show Bob (the covering person)
    // Find the event for June 10 (search by DTSTART to avoid matching DTEND of previous day)
    const events = text.split("BEGIN:VEVENT");
    const wednesdayEvent = events.find((e) => e.includes("DTSTART;VALUE=DATE:20260610"));
    expect(wednesdayEvent).toContain("SUMMARY:On-Call: Bob");

    // Other days should show Alice
    const mondayEvent = events.find((e) => e.includes("DTSTART;VALUE=DATE:20260608"));
    expect(mondayEvent).toContain("SUMMARY:On-Call: Alice");
  });

  it("returns empty VCALENDAR when no schedules exist", async () => {
    const validToken = "abcdef1234567890abcdef1234567890";
    mockPrisma.calendarToken.findFirst.mockResolvedValue({
      id: "ct1",
      token: validToken,
      createdAt: new Date(),
    });
    mockPrisma.schedule.findMany.mockResolvedValue([]);

    const req = new NextRequest(
      `http://localhost/api/schedule/calendar.ics?token=${validToken}`
    );
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("END:VCALENDAR");
    expect(text).not.toContain("BEGIN:VEVENT");
  });
});
