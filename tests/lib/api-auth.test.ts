import { describe, it, expect } from "vitest";
import { mockAuth, mockNoSession, mockSession } from "../setup";

// Unmock api-auth so we test the real implementation
import { vi } from "vitest";
vi.unmock("@/lib/api-auth");

describe("requireApiAuth", () => {
  let requireApiAuth: typeof import("@/lib/api-auth").requireApiAuth;

  beforeEach(async () => {
    const mod = await import("@/lib/api-auth");
    requireApiAuth = mod.requireApiAuth;
  });

  it("returns session when authenticated", async () => {
    const user = mockSession({ id: "user-1", name: "Alice" });
    const result = await requireApiAuth();

    expect(result.session).not.toBeNull();
    expect(result.session!.user).toEqual(user);
    expect(result.error).toBeNull();
  });

  it("returns 401 response when not authenticated", async () => {
    mockNoSession();
    const result = await requireApiAuth();

    expect(result.session).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.status).toBe(401);
  });
});
