import { describe, it, expect } from "vitest";
import { PUT } from "@/app/api/users/[id]/verify/route";
import {
  mockPrisma,
  mockAdminSession,
  mockSession,
  mockNoSession,
  createRequest,
} from "../setup";

// Helper to create params promise (Next.js 16 uses Promise<params>)
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PUT /api/users/[id]/verify", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = createRequest("/api/users/user-1/verify", { method: "PUT" });
    const res = await PUT(req, makeParams("user-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockSession({ roles: ["ENGINEER"] });
    const req = createRequest("/api/users/user-1/verify", { method: "PUT" });
    const res = await PUT(req, makeParams("user-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when user does not exist", async () => {
    mockAdminSession();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const req = createRequest("/api/users/nonexistent/verify", { method: "PUT" });
    const res = await PUT(req, makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when user is already verified", async () => {
    mockAdminSession();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      verified: true,
      name: "Test",
      fullName: "Test User",
    });
    const req = createRequest("/api/users/user-1/verify", { method: "PUT" });
    const res = await PUT(req, makeParams("user-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("already verified");
  });

  it("approves a pending user successfully", async () => {
    mockAdminSession();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      verified: false,
      name: "newuser",
      fullName: null,
    });
    mockPrisma.user.update.mockResolvedValue({ id: "user-2", verified: true });

    const req = createRequest("/api/users/user-2/verify", { method: "PUT" });
    const res = await PUT(req, makeParams("user-2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { verified: true },
    });
  });
});
