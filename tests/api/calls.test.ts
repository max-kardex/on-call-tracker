import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/calls/route";
import { mockPrisma, mockSession, mockNoSession, mockSlack } from "../setup";

describe("GET /api/calls", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/calls");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns paginated call logs", async () => {
    mockSession();
    const calls = [
      { id: "c1", severity: "P2", title: "Test call" },
      { id: "c2", severity: "P3", title: "Another call" },
    ];
    mockPrisma.callLog.findMany.mockResolvedValue(calls);
    mockPrisma.callLog.count.mockResolvedValue(2);

    const req = new NextRequest("http://localhost/api/calls?page=1&limit=20");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.calls).toHaveLength(2);
    expect(data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it("filters by severity", async () => {
    mockSession();
    mockPrisma.callLog.findMany.mockResolvedValue([]);
    mockPrisma.callLog.count.mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/calls?severity=P1");
    await GET(req);

    expect(mockPrisma.callLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "P1" }),
      })
    );
  });

  it("filters by userId", async () => {
    mockSession();
    mockPrisma.callLog.findMany.mockResolvedValue([]);
    mockPrisma.callLog.count.mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/calls?userId=user-1");
    await GET(req);

    expect(mockPrisma.callLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });

  it("filters by date range", async () => {
    mockSession();
    mockPrisma.callLog.findMany.mockResolvedValue([]);
    mockPrisma.callLog.count.mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/calls?from=2026-06-01&to=2026-06-30");
    await GET(req);

    expect(mockPrisma.callLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startTime: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    );
  });

  it("calculates correct pagination with multiple pages", async () => {
    mockSession();
    mockPrisma.callLog.findMany.mockResolvedValue([{ id: "c1" }]);
    mockPrisma.callLog.count.mockResolvedValue(45);

    const req = new NextRequest("http://localhost/api/calls?page=2&limit=20");
    const res = await GET(req);
    const data = await res.json();

    expect(data.pagination.totalPages).toBe(3);
    expect(mockPrisma.callLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
      })
    );
  });
});

describe("POST /api/calls", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: "s1",
        severity: "P2",
        title: "Test",
        startTime: "2026-06-15T10:00:00",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({ severity: "P2" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required fields");
  });

  it("calculates duration from start and end times", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.callLog.create.mockResolvedValue({
      id: "c1",
      duration: 90,
      user: { id: "user-1", name: "Alice", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: "s1",
        severity: "P3",
        title: "Slow query",
        startTime: "2026-06-15T10:00:00",
        endTime: "2026-06-15T11:30:00",
      }),
    });
    await POST(req);

    expect(mockPrisma.callLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duration: 90, // 90 minutes
        }),
      })
    );
  });

  it("sets duration to null when no endTime", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.callLog.create.mockResolvedValue({
      id: "c1",
      duration: null,
      user: { id: "user-1", name: "Alice", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: "s1",
        severity: "P3",
        title: "Ongoing issue",
        startTime: "2026-06-15T10:00:00",
      }),
    });
    await POST(req);

    expect(mockPrisma.callLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duration: null,
        }),
      })
    );
  });

  it("triggers Slack notification for P1 severity", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.callLog.create.mockResolvedValue({
      id: "c1",
      user: { id: "user-1", name: "Alice", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: "s1",
        severity: "P1",
        title: "Production down",
        startTime: "2026-06-15T10:00:00",
      }),
    });
    await POST(req);

    expect(mockSlack.notifyHighSeverityCall).toHaveBeenCalledWith("Alice", "P1", "Production down");
  });

  it("triggers Slack notification for P2 severity", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.callLog.create.mockResolvedValue({
      id: "c1",
      user: { id: "user-1", name: "Bob", email: "b@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: "s1",
        severity: "P2",
        title: "Degraded service",
        startTime: "2026-06-15T10:00:00",
      }),
    });
    await POST(req);

    expect(mockSlack.notifyHighSeverityCall).toHaveBeenCalledWith("Bob", "P2", "Degraded service");
  });

  it("does NOT trigger Slack for P3/P4 severity", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.callLog.create.mockResolvedValue({
      id: "c1",
      user: { id: "user-1", name: "Alice", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: "s1",
        severity: "P3",
        title: "Minor issue",
        startTime: "2026-06-15T10:00:00",
      }),
    });
    await POST(req);

    expect(mockSlack.notifyHighSeverityCall).not.toHaveBeenCalled();
  });

  it("returns 201 on success", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.callLog.create.mockResolvedValue({
      id: "c1",
      severity: "P3",
      user: { id: "user-1", name: "Alice", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: "s1",
        severity: "P3",
        title: "Test",
        startTime: "2026-06-15T10:00:00",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });
});
