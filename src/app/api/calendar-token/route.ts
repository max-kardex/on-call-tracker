import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * Generate a 32-character hex token.
 */
function generateCalendarToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Build the full subscription URL from the token.
 */
function buildSubscriptionUrl(token: string, headersList: Headers): string {
  const host = headersList.get("host") || "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") || "http";
  return `${proto}://${host}/api/schedule/calendar.ics?token=${token}`;
}

/**
 * GET /api/calendar-token
 * Admin only: returns the current calendar subscription token and URL.
 */
export async function GET() {
  const { session, error } = await requireApiRole("ADMIN");
  if (error) return error;

  const existing = await prisma.calendarToken.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!existing) {
    return NextResponse.json({ token: null, url: null });
  }

  const headersList = await headers();
  const url = buildSubscriptionUrl(existing.token, headersList);

  return NextResponse.json({
    token: existing.token,
    url,
    createdAt: existing.createdAt,
  });
}

/**
 * POST /api/calendar-token
 * Admin only: generates a new calendar token (replaces the old one).
 */
export async function POST() {
  const { session, error } = await requireApiRole("ADMIN");
  if (error) return error;

  const newToken = generateCalendarToken();

  // Delete all old tokens and create new one
  await prisma.$transaction([
    prisma.calendarToken.deleteMany({}),
    prisma.calendarToken.create({
      data: { token: newToken },
    }),
  ]);

  const headersList = await headers();
  const url = buildSubscriptionUrl(newToken, headersList);

  return NextResponse.json({ token: newToken, url });
}
