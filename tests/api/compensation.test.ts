import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/compensation/route";
import { mockPrisma, mockSession, mockAdminSession, mockNoSession } from "../setup";

describe("GET /api/compensation - list", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/compensation");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns all compensation records unfiltered", async () => {
    mockSession();
    const records = [
      { id: "r1", userId: "u1", hoursEarned: 8, user: { id: "u1", name: "Alice", email: "a@test.com" } },
    ];
    mockPrisma.ptoCompensation.findMany.mockResolvedValue(records);

    const req = new NextRequest("http://localhost/api/compensation");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it("filters by userId", async () => {
    mockSession();
    mockPrisma.ptoCompensation.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/compensation?userId=u1");
    await GET(req);

    expect(mockPrisma.ptoCompensation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u1" }),
      })
    );
  });
});

describe("GET /api/compensation - calculate", () => {
  it("calculates compensation per engineer using rules", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", name: "Base Weekly", ruleType: "base_weekly", value: 4, isActive: true },
      { id: "r2", name: "Per Call", ruleType: "per_call", value: 1, isActive: true },
      { id: "r3", name: "P1 Multiplier", ruleType: "severity_multiplier", value: 3, severity: "P1", isActive: true },
      { id: "r4", name: "P2 Multiplier", ruleType: "severity_multiplier", value: 2, severity: "P2", isActive: true },
    ]);

    mockPrisma.schedule.findMany.mockResolvedValue([
      {
        id: "s1",
        userId: "u1",
        weekStart: new Date("2026-06-01"),
        user: { id: "u1", name: "Alice", email: "a@test.com" },
        callLogs: [
          { id: "c1", severity: "P1" },
          { id: "c2", severity: "P3" },
        ],
      },
      {
        id: "s2",
        userId: "u1",
        weekStart: new Date("2026-06-08"),
        user: { id: "u1", name: "Alice", email: "a@test.com" },
        callLogs: [
          { id: "c3", severity: "P2" },
        ],
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.compensation).toHaveLength(1);

    const alice = data.compensation[0];
    expect(alice.userId).toBe("u1");
    expect(alice.weeksOnCall).toBe(2);
    expect(alice.totalCalls).toBe(3);
    expect(alice.baseHours).toBe(8); // 2 weeks * 4 hours
    // P1 call: 1 * 3 = 3 hours
    // P3 call: 1 * 1 = 1 hour (no severity multiplier, defaults to 1)
    // P2 call: 1 * 2 = 2 hours
    expect(alice.callHours).toBe(6); // 3 + 1 + 2
    expect(alice.totalHours).toBe(14); // 8 + 6
  });

  it("handles missing rules gracefully (defaults to 0)", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([]);
    mockPrisma.schedule.findMany.mockResolvedValue([
      {
        id: "s1",
        userId: "u1",
        weekStart: new Date("2026-06-01"),
        user: { id: "u1", name: "Alice", email: "a@test.com" },
        callLogs: [{ id: "c1", severity: "P1" }],
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const alice = data.compensation[0];
    expect(alice.baseHours).toBe(0);
    expect(alice.callHours).toBe(0);
    expect(alice.totalHours).toBe(0);
  });

  it("aggregates calls by severity", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([]);
    mockPrisma.schedule.findMany.mockResolvedValue([
      {
        id: "s1",
        userId: "u1",
        weekStart: new Date("2026-06-01"),
        user: { id: "u1", name: "Alice", email: "a@test.com" },
        callLogs: [
          { id: "c1", severity: "P1" },
          { id: "c2", severity: "P1" },
          { id: "c3", severity: "P3" },
        ],
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const alice = data.compensation[0];
    expect(alice.callsBySeverity.P1).toBe(2);
    expect(alice.callsBySeverity.P3).toBe(1);
  });
});

describe("GET /api/compensation - export CSV", () => {
  it("returns CSV with correct headers", async () => {
    mockSession();
    mockPrisma.ptoCompensation.findMany.mockResolvedValue([
      {
        id: "r1",
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-30"),
        hoursEarned: 12,
        reason: "June on-call",
        isApproved: true,
        user: { name: "Alice", email: "alice@test.com" },
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=export&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);

    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const text = await res.text();
    expect(text).toContain("Name,Email,Period Start,Period End,Hours Earned,Reason,Approved");
    expect(text).toContain("Alice");
    expect(text).toContain("alice@test.com");
    expect(text).toContain("12");
    expect(text).toContain("Yes");
  });

  it("escapes quotes in CSV reason field", async () => {
    mockSession();
    mockPrisma.ptoCompensation.findMany.mockResolvedValue([
      {
        id: "r1",
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-30"),
        hoursEarned: 8,
        reason: 'Had a "tough" week',
        isApproved: false,
        user: { name: "Bob", email: "bob@test.com" },
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=export&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const text = await res.text();

    // Quotes should be escaped as double-quotes in CSV
    expect(text).toContain('""tough""');
    expect(text).toContain("No");
  });
});

describe("POST /api/compensation - save record", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/compensation", {
      method: "POST",
      body: JSON.stringify({
        userId: "u1",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        hoursEarned: 8,
        reason: "Test",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates a compensation record and returns 201", async () => {
    mockAdminSession();
    mockPrisma.ptoCompensation.create.mockResolvedValue({
      id: "r1",
      userId: "u1",
      hoursEarned: 8,
    });

    const req = new NextRequest("http://localhost/api/compensation", {
      method: "POST",
      body: JSON.stringify({
        userId: "u1",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        hoursEarned: 8,
        reason: "June compensation",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.ptoCompensation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          hoursEarned: 8,
          reason: "June compensation",
        }),
      })
    );
  });
});

describe("POST /api/compensation - save rules", () => {
  it("deactivates all existing rules then upserts new ones", async () => {
    mockAdminSession();
    mockPrisma.compensationRule.update.mockResolvedValue({ id: "rule-1" });
    mockPrisma.compensationRule.create.mockResolvedValue({ id: "rule-new" });

    const rules = [
      { id: "rule-1", name: "Base Weekly", ruleType: "base_weekly", value: 4, isActive: true },
      { name: "New Rule", ruleType: "per_call", value: 1, isActive: true },
    ];

    const req = new NextRequest("http://localhost/api/compensation", {
      method: "POST",
      body: JSON.stringify({ action: "save_rules", rules }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Should deactivate all first
    expect(mockPrisma.compensationRule.updateMany).toHaveBeenCalledWith({
      data: { isActive: false },
    });
    // Should update existing rule
    expect(mockPrisma.compensationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rule-1" } })
    );
    // Should create new rule (no id)
    expect(mockPrisma.compensationRule.create).toHaveBeenCalled();
  });
});
