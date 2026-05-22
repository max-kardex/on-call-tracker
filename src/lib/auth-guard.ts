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

/** Can the user create swap board posts? (ENGINEER or ADMIN) */
export function canCreateSwap(session: Session | null): boolean {
  return hasAnyRole(session, ["ENGINEER", "ADMIN"]);
}

/**
 * Can the user claim a swap board post?
 * Rules:
 * 1. Must be an ENGINEER or ADMIN
 * 2. Cannot claim your own post
 */
export function canClaimSwap(
  session: Session | null,
  swap: { posterId: string }
): boolean {
  if (!session?.user) return false;
  if (session.user.id === swap.posterId) return false;
  return hasAnyRole(session, ["ENGINEER", "ADMIN"]);
}

/**
 * Can the user cancel a swap board post?
 * Rules:
 * 1. The poster can always cancel their own post
 * 2. MANAGER or ADMIN can cancel any post (moderation)
 */
export function canCancelSwap(
  session: Session | null,
  swap: { posterId: string }
): boolean {
  if (!session?.user) return false;
  if (session.user.id === swap.posterId) return true;
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
