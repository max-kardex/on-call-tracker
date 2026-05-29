import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * Generate a random 8-character alphanumeric code (uppercase)
 */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars: I, O, 0, 1
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * GET /api/invite-code
 * Admin only: returns the current active invite code.
 */
export async function GET() {
  const { session, error } = await requireApiRole("ADMIN");
  if (error) return error;

  const latestCode = await prisma.inviteCode.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { fullName: true, name: true } },
    },
  });

  if (!latestCode) {
    return NextResponse.json({ code: null, createdAt: null, createdBy: null });
  }

  return NextResponse.json({
    code: latestCode.code,
    createdAt: latestCode.createdAt,
    createdBy: latestCode.createdBy.fullName || latestCode.createdBy.name,
  });
}

/**
 * POST /api/invite-code
 * Admin only: generates a new invite code (replaces the old one).
 */
export async function POST() {
  const { session, error } = await requireApiRole("ADMIN");
  if (error) return error;

  const newCode = generateInviteCode();

  // Delete all old codes and create new one in a transaction
  await prisma.$transaction([
    prisma.inviteCode.deleteMany({}),
    prisma.inviteCode.create({
      data: {
        code: newCode,
        createdById: session!.user.id,
      },
    }),
  ]);

  return NextResponse.json({ code: newCode });
}
