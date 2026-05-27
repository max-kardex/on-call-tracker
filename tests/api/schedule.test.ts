import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, PUT, DELETE } from "@/app/api/schedule/route";
import {
  mockPrisma,
  mockSession,
  mockAdminSession,
  mockManagerSession,
  mockNoSession,
  mockSlack,
  mockNotifications,
} from "../setup";

describe("GET /api/schedule", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/schedule");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns all schedules when no filters", async () => {
    mockSession();
    const schedules = [
      { id: "s1", userId: "u1", weekStart: new Date("2026-06-01"), weekEnd: new Date("2026-06-07") },
    ];
    mockPrisma.schedule.findMany.mockResolvedValue(schedules);

    const req = new NextRequest("http://localhost/api/schedule");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it("filters by from/to date params (overlap-based)", async () => {
    mockSession();
    mockPrisma.schedule.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/schedule?from=2026-06-01&to=2026-06-30");
    await GET(req);

    // Overlap logic: weekStart <= to AND weekEnd >= from
    expect(mockPrisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          weekStart: { lte: expect.any(Date) },
          weekEnd: { gte: expect.any(Date) },
        }),
      })
    );
  });
});

describe("POST /api/schedule - self-assign", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "self-assign", weekStart: "2026-07-06" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects self-assign to a past week", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "self-assign", weekStart: "2020-01-06" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("past week");
  });

  it("rejects self-assign if week is already assigned (409)", async () => {
    mockSession();
    mockPrisma.schedule.findFirst.mockResolvedValue({ id: "existing" });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "self-assign", weekStart: "2027-06-07" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already assigned");
  });

  it("creates a self-assigned schedule entry for future week", async () => {
    mockSession({ id: "user-1", name: "Alice" });
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.schedule.create.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      isSelfAssigned: true,
      user: { id: "user-1", name: "Alice", email: "alice@test.com", image: null },
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "self-assign", weekStart: "2027-06-07" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isSelfAssigned).toBe(true);
    expect(mockPrisma.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          isSelfAssigned: true,
          isOverride: false,
        }),
      })
    );
  });

  it("calls notifyVolunteer on successful self-assign", async () => {
    mockSession({ id: "user-1", name: "Alice" });
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.schedule.create.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      isSelfAssigned: true,
      user: { id: "user-1", name: "Alice", email: "alice@test.com", image: null },
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "self-assign", weekStart: "2027-06-07" }),
    });
    await POST(req);

    expect(mockSlack.notifyVolunteer).toHaveBeenCalledWith("Alice", expect.any(String));
  });

  it("handles full ISO date string for weekStart in self-assign", async () => {
    mockSession({ id: "user-1", name: "Alice" });
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.schedule.create.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      isSelfAssigned: true,
      weekStart: new Date("2027-06-07T00:00:00.000Z"),
      user: { id: "user-1", name: "Alice", fullName: "Alice A", email: "alice@test.com", image: null },
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "self-assign", weekStart: "2027-06-07T00:00:00.000Z" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify the create call used valid dates
    const createCall = mockPrisma.schedule.create.mock.calls[0][0];
    expect(createCall.data.weekStart).toBeInstanceOf(Date);
    expect(isNaN(createCall.data.weekStart.getTime())).toBe(false);
    expect(createCall.data.weekEnd).toBeInstanceOf(Date);
    expect(isNaN(createCall.data.weekEnd.getTime())).toBe(false);
  });
});

describe("POST /api/schedule - generate rotation", () => {
  it("uses all active engineers when none specified", async () => {
    mockManagerSession();
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1" },
      { id: "u2" },
      { id: "u3" },
    ]);
    mockPrisma.schedule.findMany.mockResolvedValue([]);
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.schedule.upsert.mockImplementation(async (args) => ({
      ...args.create,
      id: "generated-id",
      user: { id: args.create.userId, name: "User", email: "u@test.com" },
    }));

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "generate", startDate: "2027-06-01", weeks: 3 }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(3);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, roles: { has: "ENGINEER" } } })
    );
  });

  it("returns 400 if no engineers available", async () => {
    mockManagerSession();
    mockPrisma.user.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ action: "generate", startDate: "2027-06-01", weeks: 3 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("skips already-assigned weeks", async () => {
    mockManagerSession();
    // The handler computes startOfWeek(new Date("2027-06-01T12:00:00"), {weekStartsOn:1})
    // which gives Monday 2027-06-01 (since Jun 1 2027 IS a Monday according to date-fns behavior, but let's
    // compute to match exactly what the handler produces).
    const { startOfWeek } = await import("date-fns");
    const baseDate = startOfWeek(new Date("2027-06-01T12:00:00"), { weekStartsOn: 1 });

    // Simulate week 1 (baseDate) already assigned - the Set uses toISOString()
    mockPrisma.schedule.findMany.mockResolvedValue([
      { weekStart: baseDate, userId: "u1", isSelfAssigned: false },
    ]);
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.schedule.upsert.mockImplementation(async (args) => ({
      ...args.create,
      id: "id",
      user: { id: args.create.userId, name: "User", email: "u@test.com" },
    }));

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({
        action: "generate",
        startDate: "2027-06-01",
        weeks: 3,
        engineerIds: ["u1", "u2", "u3"],
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    // Should generate 2 entries (week 1 is skipped)
    expect(data.count).toBe(2);
  });

  it("deprioritizes self-assigned engineers in rotation order", async () => {
    mockManagerSession();
    // u2 is self-assigned in the window
    mockPrisma.schedule.findMany.mockResolvedValue([
      { weekStart: new Date("2027-06-02T00:00:00Z"), userId: "u2", isSelfAssigned: true },
    ]);
    mockPrisma.schedule.findFirst.mockResolvedValue(null);

    const upsertCalls: string[] = [];
    mockPrisma.schedule.upsert.mockImplementation(async (args) => {
      upsertCalls.push(args.create.userId);
      return {
        ...args.create,
        id: "id",
        user: { id: args.create.userId, name: "User", email: "u@test.com" },
      };
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({
        action: "generate",
        startDate: "2027-06-01",
        weeks: 4,
        engineerIds: ["u1", "u2", "u3"],
      }),
    });
    await POST(req);

    // u2 should be last in rotation (deprioritized)
    // Rotation order: [u1, u3, u2] (u2 moved to end)
    // Week 1 is already taken (skipped), so we generate weeks 2, 3, 4
    // Assignments: u1, u3, u2
    expect(upsertCalls[0]).toBe("u1");
    expect(upsertCalls[1]).toBe("u3");
    expect(upsertCalls[2]).toBe("u2");
  });

  it("handles full ISO date string for startDate in rotation generation", async () => {
    mockManagerSession();
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    mockPrisma.schedule.findMany.mockResolvedValue([]);
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.schedule.upsert.mockImplementation(async (args) => ({
      ...args.create,
      id: "generated-id",
      weekStart: args.create.weekStart,
      user: { id: args.create.userId, name: "User", fullName: "User Name", email: "u@test.com" },
    }));

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({
        action: "generate",
        startDate: "2027-06-01T00:00:00.000Z",
        weeks: 2,
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(2);

    // Verify upsert was called with valid dates
    const upsertCall = mockPrisma.schedule.upsert.mock.calls[0][0];
    expect(upsertCall.create.weekStart).toBeInstanceOf(Date);
    expect(isNaN(upsertCall.create.weekStart.getTime())).toBe(false);
  });
});

describe("POST /api/schedule - create entry", () => {
  it("creates a manual override entry", async () => {
    mockManagerSession();
    mockPrisma.schedule.create.mockResolvedValue({
      id: "s1",
      userId: "u1",
      isOverride: true,
      isSelfAssigned: false,
      user: { id: "u1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", weekStart: "2027-06-01", notes: "Override" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isOverride).toBe(true);
    expect(mockPrisma.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          isOverride: true,
          isSelfAssigned: false,
        }),
      })
    );
  });

  it("handles full ISO date string for weekStart in manual create", async () => {
    mockManagerSession();
    mockPrisma.schedule.create.mockResolvedValue({
      id: "s1",
      userId: "u1",
      weekStart: new Date("2027-06-02T00:00:00.000Z"),
      isOverride: true,
      isSelfAssigned: false,
      user: { id: "u1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", weekStart: "2027-06-01T00:00:00.000Z", notes: "ISO date" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify create was called with valid dates
    const createCall = mockPrisma.schedule.create.mock.calls[0][0];
    expect(createCall.data.weekStart).toBeInstanceOf(Date);
    expect(isNaN(createCall.data.weekStart.getTime())).toBe(false);
    expect(createCall.data.weekEnd).toBeInstanceOf(Date);
    expect(isNaN(createCall.data.weekEnd.getTime())).toBe(false);
  });

  it("sends in-app and Slack notifications on manual assignment", async () => {
    mockManagerSession();
    mockPrisma.schedule.create.mockResolvedValue({
      id: "s1",
      userId: "u1",
      weekStart: new Date("2027-06-02T00:00:00.000Z"),
      isOverride: true,
      isSelfAssigned: false,
      user: { id: "u1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", weekStart: "2027-06-01" }),
    });
    await POST(req);

    expect(mockNotifications.notifyWeekAssigned).toHaveBeenCalledWith(
      "u1",
      expect.any(String),
      "an admin"
    );
    expect(mockSlack.notifyRotationReminder).toHaveBeenCalledWith(
      "Alice A",
      expect.any(String)
    );
  });
});

describe("PUT /api/schedule", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/schedule", {
      method: "PUT",
      body: JSON.stringify({ id: "s1", userId: "u2" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("updates schedule entry and clears self-assigned flag", async () => {
    mockManagerSession();
    mockPrisma.schedule.update.mockResolvedValue({
      id: "s1",
      userId: "u2",
      isOverride: true,
      isSelfAssigned: false,
      user: { id: "u2", name: "Bob", email: "b@test.com" },
    });

    const req = new NextRequest("http://localhost/api/schedule", {
      method: "PUT",
      body: JSON.stringify({ id: "s1", userId: "u2", notes: "Reassigned" }),
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isSelfAssigned).toBe(false);
    expect(mockPrisma.schedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isOverride: true,
          isSelfAssigned: false,
        }),
      })
    );
  });
});

describe("DELETE /api/schedule", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no ID provided", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/schedule", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("allows admin to delete any entry", async () => {
    mockAdminSession();
    mockPrisma.schedule.delete.mockResolvedValue({ id: "s1" });

    const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.schedule.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("allows non-admin to delete own self-assigned entry", async () => {
    mockSession({ id: "user-1", roles: ["ENGINEER"] });
    mockPrisma.schedule.findUnique.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      isSelfAssigned: true,
    });
    mockPrisma.schedule.delete.mockResolvedValue({ id: "s1" });

    const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
    const res = await DELETE(req);

    expect(res.status).toBe(200);
  });

  it("rejects non-admin deleting others entry (403)", async () => {
    mockSession({ id: "user-1", roles: ["ENGINEER"] });
    mockPrisma.schedule.findUnique.mockResolvedValue({
      id: "s1",
      userId: "user-2",
      isSelfAssigned: true,
    });

    const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
    const res = await DELETE(req);

    expect(res.status).toBe(403);
  });

  it("rejects non-admin deleting own non-self-assigned entry (403)", async () => {
    mockSession({ id: "user-1", roles: ["ENGINEER"] });
    mockPrisma.schedule.findUnique.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      isSelfAssigned: false,
    });

    const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
    const res = await DELETE(req);

    expect(res.status).toBe(403);
  });

  it("returns 404 when entry not found (non-admin)", async () => {
    mockSession({ id: "user-1", roles: ["ENGINEER"] });
    mockPrisma.schedule.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/schedule?id=nonexistent", { method: "DELETE" });
    const res = await DELETE(req);

    expect(res.status).toBe(404);
  });
});
