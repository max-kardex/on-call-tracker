import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_CONTACT_METHODS = ["SMS", "SLACK", "TEAMS", "CALL"] as const;

// GET /api/profile - Get current user profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      preferredContact: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PUT /api/profile - Update current user profile
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, image, preferredContact } = body;

  // Only allow updating name, image, and preferredContact (not email or role)
  const updateData: Record<string, string> = {};
  if (typeof name === "string" && name.trim()) {
    updateData.name = name.trim();
  }
  if (typeof image === "string") {
    updateData.image = image;
  }
  if (typeof preferredContact === "string" && VALID_CONTACT_METHODS.includes(preferredContact as any)) {
    updateData.preferredContact = preferredContact;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      preferredContact: true,
    },
  });

  return NextResponse.json(updatedUser);
}
