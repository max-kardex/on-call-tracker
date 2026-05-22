import { describe, it, expect } from "vitest";
import { mockAuth, mockNoSession, mockSession, mockAdminSession, mockManagerSession, mockEngineerSession, mockSupportSession } from "../setup";

// Unmock api-auth and auth-guard so we test the real implementations
import { vi } from "vitest";
vi.unmock("@/lib/api-auth");
vi.unmock("@/lib/auth-guard");

describe("requireApiAuth", () => {
  let requireApiAuth: typeof import("@/lib/api-auth").requireApiAuth;
  let requireApiRole: typeof import("@/lib/api-auth").requireApiRole;
  let requireApiAnyRole: typeof import("@/lib/api-auth").requireApiAnyRole;

  beforeEach(async () => {
    const mod = await import("@/lib/api-auth");
    requireApiAuth = mod.requireApiAuth;
    requireApiRole = mod.requireApiRole;
    requireApiAnyRole = mod.requireApiAnyRole;
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

describe("requireApiRole", () => {
  let requireApiRole: typeof import("@/lib/api-auth").requireApiRole;

  beforeEach(async () => {
    const mod = await import("@/lib/api-auth");
    requireApiRole = mod.requireApiRole;
  });

  it("returns session when user has the required role", async () => {
    mockAdminSession();
    const result = await requireApiRole("ADMIN");
    expect(result.session).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns 403 when user lacks the required role", async () => {
    mockEngineerSession();
    const result = await requireApiRole("ADMIN");
    expect(result.session).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const result = await requireApiRole("ADMIN");
    expect(result.session).toBeNull();
    expect(result.error!.status).toBe(401);
  });
});

describe("requireApiAnyRole", () => {
  let requireApiAnyRole: typeof import("@/lib/api-auth").requireApiAnyRole;

  beforeEach(async () => {
    const mod = await import("@/lib/api-auth");
    requireApiAnyRole = mod.requireApiAnyRole;
  });

  it("returns session when user has one of the required roles", async () => {
    mockManagerSession();
    const result = await requireApiAnyRole(["ADMIN", "MANAGER"]);
    expect(result.session).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns 403 when user has none of the required roles", async () => {
    mockSupportSession();
    const result = await requireApiAnyRole(["ADMIN", "MANAGER"]);
    expect(result.session).toBeNull();
    expect(result.error!.status).toBe(403);
  });
});

describe("Permission helper functions", () => {
  let hasRole: typeof import("@/lib/auth-guard").hasRole;
  let hasAnyRole: typeof import("@/lib/auth-guard").hasAnyRole;
  let canLogCalls: typeof import("@/lib/auth-guard").canLogCalls;
  let canManageSchedule: typeof import("@/lib/auth-guard").canManageSchedule;
  let canSelfAssign: typeof import("@/lib/auth-guard").canSelfAssign;
  let canCreateSwap: typeof import("@/lib/auth-guard").canCreateSwap;
  let canClaimSwap: typeof import("@/lib/auth-guard").canClaimSwap;
  let canCancelSwap: typeof import("@/lib/auth-guard").canCancelSwap;
  let canManageUsers: typeof import("@/lib/auth-guard").canManageUsers;
  let canManageSettings: typeof import("@/lib/auth-guard").canManageSettings;

  beforeEach(async () => {
    const mod = await import("@/lib/auth-guard");
    hasRole = mod.hasRole;
    hasAnyRole = mod.hasAnyRole;
    canLogCalls = mod.canLogCalls;
    canManageSchedule = mod.canManageSchedule;
    canSelfAssign = mod.canSelfAssign;
    canCreateSwap = mod.canCreateSwap;
    canClaimSwap = mod.canClaimSwap;
    canCancelSwap = mod.canCancelSwap;
    canManageUsers = mod.canManageUsers;
    canManageSettings = mod.canManageSettings;
  });

  function makeSession(roles: string[]) {
    return { user: { id: "u1", roles } } as any;
  }

  describe("hasRole", () => {
    it("returns true when user has the role", () => {
      expect(hasRole(makeSession(["ADMIN", "ENGINEER"]), "ADMIN")).toBe(true);
    });

    it("returns false when user lacks the role", () => {
      expect(hasRole(makeSession(["ENGINEER"]), "ADMIN")).toBe(false);
    });

    it("returns false for null session", () => {
      expect(hasRole(null, "ADMIN")).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("returns true when user has one matching role", () => {
      expect(hasAnyRole(makeSession(["ENGINEER"]), ["ADMIN", "ENGINEER"])).toBe(true);
    });

    it("returns false when no roles match", () => {
      expect(hasAnyRole(makeSession(["SUPPORT"]), ["ADMIN", "ENGINEER"])).toBe(false);
    });
  });

  describe("canLogCalls", () => {
    it("ENGINEER can log calls", () => {
      expect(canLogCalls(makeSession(["ENGINEER"]))).toBe(true);
    });

    it("MANAGER can log calls", () => {
      expect(canLogCalls(makeSession(["MANAGER"]))).toBe(true);
    });

    it("ADMIN can log calls", () => {
      expect(canLogCalls(makeSession(["ADMIN"]))).toBe(true);
    });

    it("SUPPORT cannot log calls", () => {
      expect(canLogCalls(makeSession(["SUPPORT"]))).toBe(false);
    });
  });

  describe("canManageSchedule", () => {
    it("MANAGER can manage schedule", () => {
      expect(canManageSchedule(makeSession(["MANAGER"]))).toBe(true);
    });

    it("ADMIN can manage schedule", () => {
      expect(canManageSchedule(makeSession(["ADMIN"]))).toBe(true);
    });

    it("ENGINEER cannot manage schedule", () => {
      expect(canManageSchedule(makeSession(["ENGINEER"]))).toBe(false);
    });

    it("SUPPORT cannot manage schedule", () => {
      expect(canManageSchedule(makeSession(["SUPPORT"]))).toBe(false);
    });
  });

  describe("canSelfAssign", () => {
    it("ENGINEER can self-assign", () => {
      expect(canSelfAssign(makeSession(["ENGINEER"]))).toBe(true);
    });

    it("ADMIN can self-assign", () => {
      expect(canSelfAssign(makeSession(["ADMIN"]))).toBe(true);
    });

    it("MANAGER cannot self-assign", () => {
      expect(canSelfAssign(makeSession(["MANAGER"]))).toBe(false);
    });

    it("SUPPORT cannot self-assign", () => {
      expect(canSelfAssign(makeSession(["SUPPORT"]))).toBe(false);
    });

    it("MANAGER+ENGINEER can self-assign (multi-role)", () => {
      expect(canSelfAssign(makeSession(["MANAGER", "ENGINEER"]))).toBe(true);
    });
  });

  describe("canCreateSwap", () => {
    it("ENGINEER can create swap", () => {
      expect(canCreateSwap(makeSession(["ENGINEER"]))).toBe(true);
    });

    it("ADMIN can create swap", () => {
      expect(canCreateSwap(makeSession(["ADMIN"]))).toBe(true);
    });

    it("MANAGER cannot create swap (without ENGINEER)", () => {
      expect(canCreateSwap(makeSession(["MANAGER"]))).toBe(false);
    });

    it("MANAGER+ENGINEER can create swap", () => {
      expect(canCreateSwap(makeSession(["MANAGER", "ENGINEER"]))).toBe(true);
    });

    it("SUPPORT cannot create swap", () => {
      expect(canCreateSwap(makeSession(["SUPPORT"]))).toBe(false);
    });
  });

  describe("canClaimSwap", () => {
    const post = { posterId: "user-A" };

    it("non-poster ENGINEER can claim", () => {
      const session = { user: { id: "user-B", roles: ["ENGINEER"] } } as any;
      expect(canClaimSwap(session, post)).toBe(true);
    });

    it("non-poster ADMIN can claim", () => {
      const session = { user: { id: "user-B", roles: ["ADMIN"] } } as any;
      expect(canClaimSwap(session, post)).toBe(true);
    });

    it("poster cannot claim own post (even as ADMIN)", () => {
      const session = { user: { id: "user-A", roles: ["ADMIN"] } } as any;
      expect(canClaimSwap(session, post)).toBe(false);
    });

    it("MANAGER (without ENGINEER) cannot claim", () => {
      const session = { user: { id: "user-B", roles: ["MANAGER"] } } as any;
      expect(canClaimSwap(session, post)).toBe(false);
    });

    it("SUPPORT cannot claim", () => {
      const session = { user: { id: "user-B", roles: ["SUPPORT"] } } as any;
      expect(canClaimSwap(session, post)).toBe(false);
    });

    it("null session cannot claim", () => {
      expect(canClaimSwap(null, post)).toBe(false);
    });
  });

  describe("canCancelSwap", () => {
    const post = { posterId: "user-A" };

    it("poster can cancel own post", () => {
      const session = { user: { id: "user-A", roles: ["ENGINEER"] } } as any;
      expect(canCancelSwap(session, post)).toBe(true);
    });

    it("MANAGER (non-poster) can cancel", () => {
      const session = { user: { id: "user-B", roles: ["MANAGER"] } } as any;
      expect(canCancelSwap(session, post)).toBe(true);
    });

    it("ADMIN (non-poster) can cancel", () => {
      const session = { user: { id: "user-B", roles: ["ADMIN"] } } as any;
      expect(canCancelSwap(session, post)).toBe(true);
    });

    it("non-poster ENGINEER cannot cancel", () => {
      const session = { user: { id: "user-B", roles: ["ENGINEER"] } } as any;
      expect(canCancelSwap(session, post)).toBe(false);
    });

    it("SUPPORT cannot cancel", () => {
      const session = { user: { id: "user-B", roles: ["SUPPORT"] } } as any;
      expect(canCancelSwap(session, post)).toBe(false);
    });

    it("null session cannot cancel", () => {
      expect(canCancelSwap(null, post)).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("ADMIN can manage users", () => {
      expect(canManageUsers(makeSession(["ADMIN"]))).toBe(true);
    });

    it("MANAGER cannot manage users", () => {
      expect(canManageUsers(makeSession(["MANAGER"]))).toBe(false);
    });

    it("ENGINEER cannot manage users", () => {
      expect(canManageUsers(makeSession(["ENGINEER"]))).toBe(false);
    });
  });

  describe("canManageSettings", () => {
    it("ADMIN can manage settings", () => {
      expect(canManageSettings(makeSession(["ADMIN"]))).toBe(true);
    });

    it("MANAGER cannot manage settings", () => {
      expect(canManageSettings(makeSession(["MANAGER"]))).toBe(false);
    });
  });
});
