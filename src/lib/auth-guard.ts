import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
 * Require admin role. Redirects to /dashboard if not admin.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if ((session.user as any).role !== "ADMIN") {
    redirect("/dashboard");
  }
  return session;
}
