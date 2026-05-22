import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth-guard";

 

// GET /api/users - List users
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, fullName: true, email: true, image: true, roles: true, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

// PUT /api/users - Update user (roles, active status)
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if current user is admin
  if (!hasRole(session, "ADMIN")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { id, roles, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (roles !== undefined) {
    // Validate roles array
    const validRoles = ["ADMIN", "MANAGER", "ENGINEER", "SUPPORT"];
    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: "Roles must be a non-empty array" }, { status: 400 });
    }
    const invalidRoles = roles.filter((r: string) => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      return NextResponse.json({ error: `Invalid roles: ${invalidRoles.join(", ")}` }, { status: 400 });
    }
    updateData.roles = roles;
  }

  if (isActive !== undefined) updateData.isActive = isActive;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, fullName: true, email: true, roles: true, isActive: true },
  });

  return NextResponse.json(user);
}
