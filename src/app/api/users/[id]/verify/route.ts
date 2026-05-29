import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";

/**
 * PUT /api/users/[id]/verify
 * Admin only: approves a pending user (sets verified = true).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireApiRole("ADMIN");
  if (error) return error;

  const { id } = await params;

  // Ensure user exists
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, verified: true, name: true, fullName: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.verified) {
    return NextResponse.json({ error: "User is already verified" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id },
    data: { verified: true },
  });

  return NextResponse.json({ success: true });
}
