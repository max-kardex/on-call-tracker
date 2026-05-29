import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/verify
 * Validates an invite code and marks the user as verified.
 * Accessible by any authenticated user (even unverified).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  // Find the latest active invite code
  const latestCode = await prisma.inviteCode.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!latestCode) {
    return NextResponse.json(
      { error: "No invite code has been configured. Please wait for admin approval." },
      { status: 404 }
    );
  }

  // Case-insensitive comparison
  if (latestCode.code.toUpperCase() !== code.toUpperCase()) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
  }

  // Mark user as verified
  await prisma.user.update({
    where: { id: session.user.id },
    data: { verified: true },
  });

  return NextResponse.json({ success: true });
}
