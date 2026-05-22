import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, format } from "date-fns";

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
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { periodStart: "desc" },
  });

  return NextResponse.json(records);
}

async function handleCalculate(periodStart: string | null, periodEnd: string | null) {
  const start = periodStart ? new Date(periodStart) : startOfMonth(new Date());
  const end = periodEnd ? new Date(periodEnd) : endOfMonth(new Date());

  // Get active compensation rules
  const rules = await prisma.compensationRule.findMany({
    where: { isActive: true },
  });

  const baseWeeklyRule = rules.find((r) => r.ruleType === "base_weekly");
  const perCallRule = rules.find((r) => r.ruleType === "per_call");
  const severityRules = rules.filter((r) => r.ruleType === "severity_multiplier");

  // Get all schedules in the period
  const schedules = await prisma.schedule.findMany({
    where: {
      weekStart: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      callLogs: true,
    },
  });

  // Calculate per engineer
  const compensationByUser: Record<string, {
    userId: string;
    userName: string;
    weeksOnCall: number;
    totalCalls: number;
    callsBySeverity: Record<string, number>;
    baseHours: number;
    callHours: number;
    totalHours: number;
  }> = {};

  for (const schedule of schedules) {
    const userId = schedule.userId;
    if (!compensationByUser[userId]) {
      compensationByUser[userId] = {
        userId,
        userName: schedule.user.name ?? "Unknown",
        weeksOnCall: 0,
        totalCalls: 0,
        callsBySeverity: { P1: 0, P2: 0, P3: 0, P4: 0 },
        baseHours: 0,
        callHours: 0,
        totalHours: 0,
      };
    }

    const entry = compensationByUser[userId];
    entry.weeksOnCall += 1;
    entry.baseHours += baseWeeklyRule?.value ?? 0;

    for (const call of schedule.callLogs) {
      entry.totalCalls += 1;
      entry.callsBySeverity[call.severity] = (entry.callsBySeverity[call.severity] ?? 0) + 1;

      // Calculate call compensation
      const severityMultiplier = severityRules.find((r) => r.severity === call.severity)?.value ?? 1;
      const perCallHours = perCallRule?.value ?? 0;
      entry.callHours += perCallHours * severityMultiplier;
    }

    entry.totalHours = entry.baseHours + entry.callHours;
  }

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString() },
    rules: rules.map((r) => ({ name: r.name, type: r.ruleType, value: r.value, severity: r.severity })),
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
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ user: { name: "asc" } }, { periodStart: "asc" }],
  });

  // Build CSV
  const headers = "Name,Email,Period Start,Period End,Hours Earned,Reason,Approved";
  const rows = records.map((r) =>
    [
      r.user.name ?? "",
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
