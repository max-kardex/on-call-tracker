import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getRoles, hasRole, hasAnyRole } from "@/lib/auth-guard";

/**
 * Validate that the request is authenticated. Use in API routes.
 * Returns the session if valid, or a 401 response.
 */
export async function requireApiAuth() {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

/**
 * Require a specific role in API routes.
 * Returns 403 if the user doesn't have the required role.
 */
export async function requireApiRole(role: string) {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(session, role)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }) };
  }
  return { session, error: null };
}

/**
 * Require any of the specified roles in API routes.
 * Returns 403 if the user doesn't have any of the required roles.
 */
export async function requireApiAnyRole(roles: string[]) {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasAnyRole(session, roles)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }) };
  }
  return { session, error: null };
}

export { getRoles, hasRole, hasAnyRole };
