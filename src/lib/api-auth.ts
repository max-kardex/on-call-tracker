import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

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
