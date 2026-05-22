import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/users/route";
import { mockPrisma, mockSession, mockAdminSession, mockNoSession } from "../setup";

describe("GET /api/users", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns all users sorted by name", async () => {
    mockSession();
    const users = [
      { id: "u1", name: "alice", email: "a@test.com", image: null, role: "ENGINEER", isActive: true },
      { id: "u2", name: "bob", email: "b@test.com", image: null, role: "ADMIN", isActive: true },
    ];
    mockPrisma.user.findMany.mockResolvedValue(users);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } })
    );
  });
});

describe("PUT /api/users", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/users", {
      method: "PUT",
      body: JSON.stringify({ id: "u1", role: "ADMIN" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin tries to update", async () => {
    mockSession({ id: "user-1", role: "ENGINEER" });
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ENGINEER" });

    const req = new NextRequest("http://localhost/api/users", {
      method: "PUT",
      body: JSON.stringify({ id: "u2", role: "ADMIN" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Admin access required");
  });

  it("returns 400 when no user ID provided", async () => {
    mockAdminSession({ id: "admin-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    const req = new NextRequest("http://localhost/api/users", {
      method: "PUT",
      body: JSON.stringify({ role: "ADMIN" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("User ID required");
  });

  it("allows admin to update user role", async () => {
    mockAdminSession({ id: "admin-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    mockPrisma.user.update.mockResolvedValue({
      id: "u2",
      name: "bob",
      email: "b@test.com",
      role: "ADMIN",
      isActive: true,
    });

    const req = new NextRequest("http://localhost/api/users", {
      method: "PUT",
      body: JSON.stringify({ id: "u2", role: "ADMIN" }),
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe("ADMIN");
  });

  it("allows admin to deactivate a user", async () => {
    mockAdminSession({ id: "admin-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    mockPrisma.user.update.mockResolvedValue({
      id: "u2",
      name: "bob",
      email: "b@test.com",
      role: "ENGINEER",
      isActive: false,
    });

    const req = new NextRequest("http://localhost/api/users", {
      method: "PUT",
      body: JSON.stringify({ id: "u2", isActive: false }),
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isActive).toBe(false);
  });
});
