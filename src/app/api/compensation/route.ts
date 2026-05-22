import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { hasRole } from "@/lib/auth-guard";
import { getAllHolidays, calculateCallPto, type HolidayEntry } from "@/lib/holidays";

export const runtime = "nodejs";

// GET /api/compensation - Calculate/list compensation
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const periodStart = searchParams.get("periodStart");
  const periodEnd = searchParams.get("periodEnd");
  const action = searchParams.get("action");

  // Export to CSV
  if (action === "export") {
    return handleExport(periodStart, periodEnd);
  }

  // Calculate compensation for a period
  if (action === "calculate") {
    return handleCalculate(periodStart, periodEnd);
  }

  // List existing compensation records
  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (periodStart) {
    where.periodStart = { gte: new Date(periodStart) };
  }
  if (periodEnd) {
    where.periodEnd = { lte: new Date(periodEnd) };
  }

  const records = await prisma.ptoCompensation.findMany({
    where,
    include: { user: { select: { id: true, name: true, fullName: true, email: true } } },
    orderBy: { periodStart: "desc" },
  });

  return NextResponse.json(records);
}

async function handleCalculate(periodStart: string | null, periodEnd: string | null) {
  const start = periodStart ? new Date(periodStart + "T00:00:00") : startOfMonth(new Date());
  const end = periodEnd ? new Date(periodEnd + "T23:59:59") : endOfMonth(new Date());

  // Get active compensation rules
  const rules = await prisma.compensationRule.findMany({
    where: { isActive: true },
  });

  // Build severity multiplier map
  const severityMultipliers: Record<string, number> = {};
  for (const rule of rules) {
    if (rule.ruleType === "severity_multiplier" && rule.severity) {
      severityMultipliers[rule.severity] = rule.value;
    }
  }

  // Get period cap
  const capRule = rules.find((r) => r.ruleType === "period_cap");
  const periodCap = capRule?.value ?? null; // null means no cap

  // Get time multipliers
  const weekendMult = rules.find((r) => r.ruleType === "weekend_multiplier")?.value ?? 2;
  const holidayMult = rules.find((r) => r.ruleType === "holiday_multiplier")?.value ?? 2;

  // Get holidays for the period
  const customHolidaysDb = await prisma.holiday.findMany({
    where: {
      date: { gte: start, lte: end },
    },
  });
  const customHolidays: HolidayEntry[] = customHolidaysDb.map((h) => ({
    date: h.date,
    name: h.name,
  }));
  const allHolidays = getAllHolidays(start, end, customHolidays);

  // Get all call logs in the period (directly, not through schedule)
  const callLogs = await prisma.callLog.findMany({
    where: {
      startTime: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, name: true, fullName: true, email: true } },
    },
  });

  // Calculate per engineer
  const compensationByUser: Record<string, {
    userId: string;
    userName: string;
    totalCalls: number;
    callsBySeverity: Record<string, number>;
    regularCalls: number;
    weekendHolidayCalls: number;
    totalPtoRaw: number;
    totalHours: number;
    capped: boolean;
  }> = {};

  for (const call of callLogs) {
    const userId = call.userId;
    if (!compensationByUser[userId]) {
      compensationByUser[userId] = {
        userId,
        userName: call.user.fullName || call.user.name || "Unknown",
        totalCalls: 0,
        callsBySeverity: { P1: 0, P2: 0, P3: 0, P4: 0 },
        regularCalls: 0,
        weekendHolidayCalls: 0,
        totalPtoRaw: 0,
        totalHours: 0,
        capped: false,
      };
    }

    const entry = compensationByUser[userId];
    entry.totalCalls += 1;
    entry.callsBySeverity[call.severity] = (entry.callsBySeverity[call.severity] ?? 0) + 1;

    // Calculate PTO for this call
    const durationMinutes = call.duration ?? 30; // Default 30 min if not set
    const { pto, dayType } = calculateCallPto(
      durationMinutes,
      call.startTime,
      call.severity,
      severityMultipliers,
      allHolidays,
      weekendMult,
      holidayMult
    );

    if (dayType !== "weekday") {
      entry.weekendHolidayCalls += 1;
    } else {
      entry.regularCalls += 1;
    }

    entry.totalPtoRaw += pto;
  }

  // Apply cap
  for (const entry of Object.values(compensationByUser)) {
    if (periodCap !== null && entry.totalPtoRaw > periodCap) {
      entry.totalHours = periodCap;
      entry.capped = true;
    } else {
      entry.totalHours = entry.totalPtoRaw;
      entry.capped = false;
    }
  }

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString() },
    rules: rules.map((r) => ({ name: r.name, type: r.ruleType, value: r.value, severity: r.severity })),
    periodCap,
    compensation: Object.values(compensationByUser),
  });
}

async function handleExport(periodStart: string | null, periodEnd: string | null) {
  const start = periodStart ? new Date(periodStart) : startOfMonth(new Date());
  const end = periodEnd ? new Date(periodEnd) : endOfMonth(new Date());

  const records = await prisma.ptoCompensation.findMany({
    where: {
      periodStart: { gte: start },
      periodEnd: { lte: end },
    },
    include: { user: { select: { name: true, fullName: true, email: true } } },
    orderBy: [{ user: { name: "asc" } }, { periodStart: "asc" }],
  });

  // Build CSV
  const headers = "Name,Email,Period Start,Period End,Hours Earned,Reason,Approved";
  const rows = records.map((r) =>
    [
      r.user.fullName || r.user.name || "",
      r.user.email ?? "",
      format(r.periodStart, "yyyy-MM-dd"),
      format(r.periodEnd, "yyyy-MM-dd"),
      r.hoursEarned.toString(),
      `"${r.reason.replace(/"/g, '""')}"`,
      r.isApproved ? "Yes" : "No",
    ].join(",")
  );

  const csv = [headers, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="pto-compensation-${format(start, "yyyy-MM")}.csv"`,
    },
  });
}

// POST /api/compensation - Create/save compensation records
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only ADMIN can manage compensation
  if (!hasRole(session, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "save_rules") {
    return handleSaveRules(body.rules);
  }

  // Save individual compensation record
  const { userId, periodStart, periodEnd, hoursEarned, reason } = body;

  const record = await prisma.ptoCompensation.create({
    data: {
      userId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      hoursEarned,
      reason,
    },
  });

  return NextResponse.json(record, { status: 201 });
}

async function handleSaveRules(rules: {
  id?: string;
  name: string;
  description?: string;
  ruleType: string;
  value: number;
  severity?: string;
  isActive: boolean;
}[]) {
  // Deactivate all existing rules, then upsert new ones
  await prisma.compensationRule.updateMany({
    data: { isActive: false },
  });

  const results: any[] = [];
  for (const rule of rules) {
    if (rule.id) {
      const updated = await prisma.compensationRule.update({
        where: { id: rule.id },
        data: {
          name: rule.name,
          description: rule.description,
          ruleType: rule.ruleType,
          value: rule.value,
          severity: rule.severity as "P1" | "P2" | "P3" | "P4" | undefined,
          isActive: rule.isActive,
        },
      });
      results.push(updated);
    } else {
      const created = await prisma.compensationRule.create({
        data: {
          name: rule.name,
          description: rule.description,
          ruleType: rule.ruleType,
          value: rule.value,
          severity: rule.severity as "P1" | "P2" | "P3" | "P4" | undefined,
          isActive: rule.isActive,
        },
      });
      results.push(created);
    }
  }

  return NextResponse.json(results);
}
