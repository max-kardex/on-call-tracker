import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/users/route";
import {
  mockPrisma,
  mockAdminSession,
  mockManagerSession,
  mockSupportSession,
  mockEngineerSession,
  mockNoSession,
} from "../setup";

describe("User Management Permissions", () => {
  describe("GET /api/users - all authenticated can view", () => {
    beforeEach(() => {
      mockPrisma.user.findMany.mockResolvedValue([]);
    });

    it("ENGINEER can view user list", async () => {
      mockEngineerSession();
      const res = await GET();
      expect(res.status).toBe(200);
    });

    it("SUPPORT can view user list", async () => {
      mockSupportSession();
      const res = await GET();
      expect(res.status).toBe(200);
    });

    it("returns 401 when unauthenticated", async () => {
      mockNoSession();
      const res = await GET();
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/users - ADMIN only", () => {
    it("ADMIN can update user roles", async () => {
      mockAdminSession({ id: "admin-1" });
      mockPrisma.user.update.mockResolvedValue({
        id: "u2",
        name: "bob",
        fullName: "Bob Jones",
        email: "b@test.com",
        roles: ["MANAGER", "ENGINEER"],
        isActive: true,
      });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: "u2", roles: ["MANAGER", "ENGINEER"] }),
      });
      const res = await PUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.roles).toEqual(["MANAGER", "ENGINEER"]);
    });

    it("MANAGER cannot update user roles", async () => {
      mockManagerSession({ id: "mgr-1" });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: "u2", roles: ["ADMIN"] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Admin access required");
    });

    it("ENGINEER cannot update user roles", async () => {
      mockEngineerSession({ id: "user-1" });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: "u2", roles: ["ADMIN"] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot update user roles", async () => {
      mockSupportSession({ id: "sup-1" });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: "u2", roles: ["ENGINEER"] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(403);
    });

    it("ADMIN can set multiple roles", async () => {
      mockAdminSession({ id: "admin-1" });
      mockPrisma.user.update.mockResolvedValue({
        id: "u2",
        name: "bob",
        fullName: "Bob",
        email: "b@test.com",
        roles: ["ADMIN", "ENGINEER"],
        isActive: true,
      });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: "u2", roles: ["ADMIN", "ENGINEER"] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
    });

    it("returns 400 for empty roles array", async () => {
      mockAdminSession({ id: "admin-1" });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: "u2", roles: [] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("non-empty array");
    });

    it("returns 400 for invalid role values", async () => {
      mockAdminSession({ id: "admin-1" });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: "u2", roles: ["INVALID_ROLE"] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid roles");
    });

    it("returns 400 when no user ID provided", async () => {
      mockAdminSession({ id: "admin-1" });

      const req = new NextRequest("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ roles: ["ENGINEER"] }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("User ID required");
    });

    it("ADMIN can deactivate a user", async () => {
      mockAdminSession({ id: "admin-1" });
      mockPrisma.user.update.mockResolvedValue({
        id: "u2",
        name: "bob",
        fullName: "Bob",
        email: "b@test.com",
        roles: ["ENGINEER"],
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
});
