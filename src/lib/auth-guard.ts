import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

// ─── Role checking helpers ────────────────────────────────────────────────────

/**
 * Get the roles array from a session user object.
 */
export function getRoles(session: Session | null): string[] {
  if (!session?.user) return [];
  return (session.user as unknown as Record<string, unknown>).roles as string[] ?? [];
}

/**
 * Check if the session user has a specific role.
 */
export function hasRole(session: Session | null, role: string): boolean {
  return getRoles(session).includes(role);
}

/**
 * Check if the session user has any of the specified roles.
 */
export function hasAnyRole(session: Session | null, roles: string[]): boolean {
  const userRoles = getRoles(session);
  return roles.some((r) => userRoles.includes(r));
}

// ─── Permission helpers ───────────────────────────────────────────────────────

/** Can the user log calls? (ENGINEER, MANAGER, or ADMIN) */
export function canLogCalls(session: Session | null): boolean {
  return hasAnyRole(session, ["ENGINEER", "MANAGER", "ADMIN"]);
}

/** Can the user manage schedules for others? (MANAGER or ADMIN) */
export function canManageSchedule(session: Session | null): boolean {
  return hasAnyRole(session, ["MANAGER", "ADMIN"]);
}

/** Can the user self-assign on-call weeks? (ENGINEER or ADMIN) */
export function canSelfAssign(session: Session | null): boolean {
  return hasAnyRole(session, ["ENGINEER", "ADMIN"]);
}

/** Can the user create swap requests? (ENGINEER or ADMIN) */
export function canCreateSwap(session: Session | null): boolean {
  return hasAnyRole(session, ["ENGINEER", "ADMIN"]);
}

/**
 * Can the user approve/reject a swap request?
 * Rules:
 * 1. The requester can NEVER approve their own request (even if admin/manager)
 * 2. The target user can always approve/reject (consent-based)
 * 3. MANAGER or ADMIN can approve/reject (override authority) if they're not the requester
 */
export function canApproveSwap(
  session: Session | null,
  swap: { requesterId: string; targetId: string }
): boolean {
  if (!session?.user) return false;
  const userId = session.user.id;

  // Rule 1: requester can never approve their own request
  if (userId === swap.requesterId) return false;

  // Rule 2: target can approve
  if (userId === swap.targetId) return true;

  // Rule 3: manager/admin can approve (unless they're the requester, already blocked above)
  return hasAnyRole(session, ["MANAGER", "ADMIN"]);
}

/** Can the user manage users/roles? (ADMIN only) */
export function canManageUsers(session: Session | null): boolean {
  return hasRole(session, "ADMIN");
}

/** Can the user manage settings (compensation rules, Slack config)? (ADMIN only) */
export function canManageSettings(session: Session | null): boolean {
  return hasRole(session, "ADMIN");
}

// ─── Server component guards ─────────────────────────────────────────────────

/**
 * Require authentication for a page. Call at the top of server components.
 * Redirects to /login if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Require a specific role. Redirects to /dashboard if missing.
 */
export async function requireRole(role: string) {
  const session = await requireAuth();
  if (!hasRole(session, role)) {
    redirect("/dashboard");
  }
  return session;
}

/**
 * Require any of the specified roles. Redirects to /dashboard if none match.
 */
export async function requireAnyRole(roles: string[]) {
  const session = await requireAuth();
  if (!hasAnyRole(session, roles)) {
    redirect("/dashboard");
  }
  return session;
}

/**
 * Require admin role. Redirects to /dashboard if not admin.
 */
export async function requireAdmin() {
  return requireRole("ADMIN");
}
