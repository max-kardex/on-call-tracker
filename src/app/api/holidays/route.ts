import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth-guard";
import { getUSFederalHolidays } from "@/lib/holidays";

export const runtime = "nodejs";

// GET /api/holidays - List all holidays (federal + custom) for a year range
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? new Date().getFullYear().toString());

  // Get US federal holidays for the requested year
  const federalHolidays = getUSFederalHolidays(year).map((h) => ({
    id: `federal-${h.name.replace(/\s+/g, "-").toLowerCase()}-${year}`,
    date: h.date.toISOString(),
    name: h.name,
    isCustom: false,
  }));

  // Get custom holidays from DB
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const customHolidays = await prisma.holiday.findMany({
    where: {
      date: { gte: startOfYear, lte: endOfYear },
    },
    orderBy: { date: "asc" },
  });

  const customFormatted = customHolidays.map((h) => ({
    id: h.id,
    date: h.date.toISOString(),
    name: h.name,
    isCustom: true,
  }));

  // Combine and sort by date
  const allHolidays = [...federalHolidays, ...customFormatted].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return NextResponse.json(allHolidays);
}

// POST /api/holidays - Add a custom holiday (ADMIN only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { date, name } = body;

  if (!date || !name) {
    return NextResponse.json({ error: "Date and name are required" }, { status: 400 });
  }

  const holidayDate = new Date(date + "T12:00:00");

  // Check for duplicate
  const existing = await prisma.holiday.findUnique({
    where: { date: holidayDate },
  });

  if (existing) {
    return NextResponse.json({ error: "A holiday already exists on this date" }, { status: 409 });
  }

  const holiday = await prisma.holiday.create({
    data: {
      date: holidayDate,
      name,
      isCustom: true,
    },
  });

  return NextResponse.json(holiday, { status: 201 });
}

// DELETE /api/holidays - Remove a custom holiday (ADMIN only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  // Only allow deleting custom holidays
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) {
    return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
  }

  if (!holiday.isCustom) {
    return NextResponse.json({ error: "Cannot delete federal holidays" }, { status: 400 });
  }

  await prisma.holiday.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
