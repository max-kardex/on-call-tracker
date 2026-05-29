import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/invite-code/route";
import {
  mockPrisma,
  mockAdminSession,
  mockSession,
  mockNoSession,
} from "../setup";

describe("GET /api/invite-code", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockSession({ roles: ["ENGINEER"] });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns null code when no invite code exists", async () => {
    mockAdminSession();
    mockPrisma.inviteCode.findFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBeNull();
  });

  it("returns the current invite code for admins", async () => {
    mockAdminSession();
    mockPrisma.inviteCode.findFirst.mockResolvedValue({
      id: "ic1",
      code: "A3F9X2K7",
      createdAt: new Date("2026-01-01"),
      createdBy: { fullName: "Admin User", name: "admin" },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe("A3F9X2K7");
    expect(data.createdBy).toBe("Admin User");
  });
});

describe("POST /api/invite-code", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockSession({ roles: ["ENGINEER"] });
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("generates a new 8-char invite code for admins", async () => {
    mockAdminSession({ id: "admin-1" });
    mockPrisma.$transaction.mockResolvedValue(undefined);

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBeDefined();
    expect(data.code.length).toBe(8);
    // Should be uppercase alphanumeric
    expect(data.code).toMatch(/^[A-Z2-9]+$/);
  });
});
