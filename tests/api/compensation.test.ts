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

describe("GET /api/compensation - calculate (new formula)", () => {
  it("calculates PTO per call: short call on weekday = 1h * sev_mult", async () => {
    mockSession();
    // Setup rules: P1=2x, P2=1x, period_cap=24
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", name: "P1 Multiplier", ruleType: "severity_multiplier", value: 2, severity: "P1", isActive: true },
      { id: "r2", name: "P2 Multiplier", ruleType: "severity_multiplier", value: 1, severity: "P2", isActive: true },
      { id: "r3", name: "Period Cap", ruleType: "period_cap", value: 24, severity: null, isActive: true },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    // Call on Wednesday (2026-06-03), 45 min, P1 severity
    mockPrisma.callLog.findMany.mockResolvedValue([
      {
        id: "c1",
        userId: "u1",
        severity: "P1",
        startTime: new Date("2026-06-03T14:00:00"), // Wednesday
        duration: 45,
        user: { id: "u1", name: "Alice", fullName: "Alice Johnson", email: "a@test.com" },
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
    expect(alice.totalCalls).toBe(1);
    // call_base=1 (45 min <= 60), time_mult=1 (weekday), sev_mult=2 (P1)
    // PTO = 1 * 1 * 2 = 2
    expect(alice.totalHours).toBe(2);
    expect(alice.regularCalls).toBe(1);
    expect(alice.weekendHolidayCalls).toBe(0);
    expect(alice.capped).toBe(false);
  });

  it("long call (>60 min) counts as 2h base", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", ruleType: "severity_multiplier", value: 1, severity: "P3", isActive: true, name: "P3" },
      { id: "r2", ruleType: "period_cap", value: 24, severity: null, isActive: true, name: "Cap" },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    // 90-minute call on a weekday
    mockPrisma.callLog.findMany.mockResolvedValue([
      {
        id: "c1",
        userId: "u1",
        severity: "P3",
        startTime: new Date("2026-06-04T10:00:00"), // Thursday
        duration: 90,
        user: { id: "u1", name: "Bob", fullName: null, email: "b@test.com" },
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const bob = data.compensation[0];
    // call_base=2 (90 min > 60), time_mult=1 (weekday), sev_mult=1 (P3)
    expect(bob.totalHours).toBe(2);
  });

  it("weekend call gets 2x time multiplier", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", ruleType: "severity_multiplier", value: 1, severity: "P2", isActive: true, name: "P2" },
      { id: "r2", ruleType: "period_cap", value: 24, severity: null, isActive: true, name: "Cap" },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    // Saturday call, 30 min, P2
    mockPrisma.callLog.findMany.mockResolvedValue([
      {
        id: "c1",
        userId: "u1",
        severity: "P2",
        startTime: new Date("2026-06-06T03:00:00"), // Saturday
        duration: 30,
        user: { id: "u1", name: "Alice", fullName: "Alice", email: "a@test.com" },
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const alice = data.compensation[0];
    // call_base=1 (30 min <= 60), time_mult=2 (Saturday), sev_mult=1 (P2)
    expect(alice.totalHours).toBe(2);
    expect(alice.weekendHolidayCalls).toBe(1);
    expect(alice.regularCalls).toBe(0);
  });

  it("holiday call gets 2x time multiplier", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", ruleType: "severity_multiplier", value: 1, severity: "P4", isActive: true, name: "P4" },
      { id: "r2", ruleType: "period_cap", value: 24, severity: null, isActive: true, name: "Cap" },
    ]);
    // Custom holiday on June 10
    mockPrisma.holiday.findMany.mockResolvedValue([
      { id: "h1", date: new Date("2026-06-10T12:00:00"), name: "Company Day", isCustom: true },
    ]);

    // Call on custom holiday (June 10 = Wednesday)
    mockPrisma.callLog.findMany.mockResolvedValue([
      {
        id: "c1",
        userId: "u1",
        severity: "P4",
        startTime: new Date("2026-06-10T15:00:00"), // Wed but it's a custom holiday
        duration: 20,
        user: { id: "u1", name: "Carol", fullName: null, email: "c@test.com" },
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const carol = data.compensation[0];
    // call_base=1, time_mult=2 (holiday), sev_mult=1 (P4)
    expect(carol.totalHours).toBe(2);
    expect(carol.weekendHolidayCalls).toBe(1);
  });

  it("applies period cap when total exceeds it", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", ruleType: "severity_multiplier", value: 1, severity: "P1", isActive: true, name: "P1" },
      { id: "r2", ruleType: "period_cap", value: 5, severity: null, isActive: true, name: "Cap" },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    // 4 weekend calls = 4 * (1 * 2 * 1) = 8 total (exceeds cap of 5)
    mockPrisma.callLog.findMany.mockResolvedValue([
      { id: "c1", userId: "u1", severity: "P1", startTime: new Date("2026-06-06T10:00:00"), duration: 30, user: { id: "u1", name: "A", fullName: null, email: "a@t.com" } },
      { id: "c2", userId: "u1", severity: "P1", startTime: new Date("2026-06-07T10:00:00"), duration: 30, user: { id: "u1", name: "A", fullName: null, email: "a@t.com" } },
      { id: "c3", userId: "u1", severity: "P1", startTime: new Date("2026-06-13T10:00:00"), duration: 30, user: { id: "u1", name: "A", fullName: null, email: "a@t.com" } },
      { id: "c4", userId: "u1", severity: "P1", startTime: new Date("2026-06-14T10:00:00"), duration: 30, user: { id: "u1", name: "A", fullName: null, email: "a@t.com" } },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const entry = data.compensation[0];
    expect(entry.totalPtoRaw).toBe(8); // uncapped
    expect(entry.totalHours).toBe(5); // capped at 5
    expect(entry.capped).toBe(true);
    expect(data.periodCap).toBe(5);
  });

  it("no cap when period_cap rule is missing", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", ruleType: "severity_multiplier", value: 1, severity: "P1", isActive: true, name: "P1" },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    // 2 weekend calls = 4h total
    mockPrisma.callLog.findMany.mockResolvedValue([
      { id: "c1", userId: "u1", severity: "P1", startTime: new Date("2026-06-06T10:00:00"), duration: 30, user: { id: "u1", name: "A", fullName: null, email: "a@t.com" } },
      { id: "c2", userId: "u1", severity: "P1", startTime: new Date("2026-06-07T10:00:00"), duration: 30, user: { id: "u1", name: "A", fullName: null, email: "a@t.com" } },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const entry = data.compensation[0];
    expect(entry.totalHours).toBe(4);
    expect(entry.capped).toBe(false);
    expect(data.periodCap).toBeNull();
  });

  it("defaults severity multiplier to 1 when not configured", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", ruleType: "period_cap", value: 24, severity: null, isActive: true, name: "Cap" },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    mockPrisma.callLog.findMany.mockResolvedValue([
      {
        id: "c1",
        userId: "u1",
        severity: "P1",
        startTime: new Date("2026-06-03T14:00:00"), // Wed
        duration: 45,
        user: { id: "u1", name: "A", fullName: null, email: "a@t.com" },
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    // call_base=1, time_mult=1, sev_mult=1 (defaulted, not configured)
    expect(data.compensation[0].totalHours).toBe(1);
  });

  it("aggregates multiple calls per engineer", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([
      { id: "r1", ruleType: "severity_multiplier", value: 2, severity: "P1", isActive: true, name: "P1" },
      { id: "r2", ruleType: "severity_multiplier", value: 1, severity: "P3", isActive: true, name: "P3" },
      { id: "r3", ruleType: "period_cap", value: 24, severity: null, isActive: true, name: "Cap" },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    mockPrisma.callLog.findMany.mockResolvedValue([
      // Weekday P1, 45min: 1*1*2 = 2
      { id: "c1", userId: "u1", severity: "P1", startTime: new Date("2026-06-03T14:00:00"), duration: 45, user: { id: "u1", name: "A", fullName: "Alice", email: "a@t.com" } },
      // Weekend P3, 90min: 2*2*1 = 4
      { id: "c2", userId: "u1", severity: "P3", startTime: new Date("2026-06-06T03:00:00"), duration: 90, user: { id: "u1", name: "A", fullName: "Alice", email: "a@t.com" } },
      // Weekday P3, 20min: 1*1*1 = 1
      { id: "c3", userId: "u1", severity: "P3", startTime: new Date("2026-06-04T09:00:00"), duration: 20, user: { id: "u1", name: "A", fullName: "Alice", email: "a@t.com" } },
    ]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    const alice = data.compensation[0];
    expect(alice.totalCalls).toBe(3);
    expect(alice.callsBySeverity.P1).toBe(1);
    expect(alice.callsBySeverity.P3).toBe(2);
    expect(alice.regularCalls).toBe(2);
    expect(alice.weekendHolidayCalls).toBe(1);
    // Total: 2 + 4 + 1 = 7
    expect(alice.totalHours).toBe(7);
  });

  it("handles no calls gracefully (empty result)", async () => {
    mockSession();
    mockPrisma.compensationRule.findMany.mockResolvedValue([]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);
    mockPrisma.callLog.findMany.mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.compensation).toHaveLength(0);
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
        user: { name: "Alice", fullName: "Alice Johnson", email: "alice@test.com" },
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
    expect(text).toContain("Alice Johnson");
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
        user: { name: "Bob", fullName: null, email: "bob@test.com" },
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

  it("returns 403 for non-admin users", async () => {
    mockSession(); // ENGINEER by default
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
    expect(res.status).toBe(403);
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
      { id: "rule-1", name: "P1 Multiplier", ruleType: "severity_multiplier", value: 2, severity: "P1", isActive: true },
      { name: "Period Cap", ruleType: "period_cap", value: 24, isActive: true },
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
