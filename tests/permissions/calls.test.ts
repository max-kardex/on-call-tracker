import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/calls/route";
import {
  mockPrisma,
  mockSession,
  mockAdminSession,
  mockManagerSession,
  mockSupportSession,
  mockEngineerSession,
  mockNoSession,
  mockSlack,
} from "../setup";

describe("Call Log Permissions", () => {
  // ─── Viewing calls (GET) ────────────────────────────────────────────────────

  describe("GET /api/calls - all roles can view", () => {
    beforeEach(() => {
      mockPrisma.callLog.findMany.mockResolvedValue([]);
      mockPrisma.callLog.count.mockResolvedValue(0);
    });

    it("ENGINEER can view calls", async () => {
      mockEngineerSession();
      const req = new NextRequest("http://localhost/api/calls");
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("MANAGER can view calls", async () => {
      mockManagerSession();
      const req = new NextRequest("http://localhost/api/calls");
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("ADMIN can view calls", async () => {
      mockAdminSession();
      const req = new NextRequest("http://localhost/api/calls");
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("SUPPORT can view calls", async () => {
      mockSupportSession();
      const req = new NextRequest("http://localhost/api/calls");
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("returns 401 when unauthenticated", async () => {
      mockNoSession();
      const req = new NextRequest("http://localhost/api/calls");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── Logging calls (POST) ──────────────────────────────────────────────────

  describe("POST /api/calls - role-based access", () => {
    const callBody = JSON.stringify({
      scheduleId: "sched-1",
      severity: "P3",
      title: "Test incident",
      startTime: "2026-06-15T10:00:00Z",
    });

    it("ENGINEER can log a call", async () => {
      mockEngineerSession({ id: "user-1" });
      mockPrisma.callLog.create.mockResolvedValue({
        id: "c1",
        severity: "P3",
        title: "Test incident",
        user: { id: "user-1", name: "Alice", fullName: "Alice Smith", email: "a@test.com" },
      });

      const req = new NextRequest("http://localhost/api/calls", {
        method: "POST",
        body: callBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("MANAGER can log a call", async () => {
      mockManagerSession({ id: "mgr-1" });
      mockPrisma.callLog.create.mockResolvedValue({
        id: "c1",
        severity: "P3",
        title: "Test incident",
        user: { id: "mgr-1", name: "Manager", fullName: "Manager Person", email: "m@test.com" },
      });

      const req = new NextRequest("http://localhost/api/calls", {
        method: "POST",
        body: callBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("ADMIN can log a call", async () => {
      mockAdminSession({ id: "admin-1" });
      mockPrisma.callLog.create.mockResolvedValue({
        id: "c1",
        severity: "P3",
        title: "Test incident",
        user: { id: "admin-1", name: "Admin", fullName: "Admin User", email: "admin@test.com" },
      });

      const req = new NextRequest("http://localhost/api/calls", {
        method: "POST",
        body: callBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("SUPPORT cannot log a call", async () => {
      mockSupportSession({ id: "sup-1" });

      const req = new NextRequest("http://localhost/api/calls", {
        method: "POST",
        body: callBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });

    it("returns 401 when unauthenticated", async () => {
      mockNoSession();

      const req = new NextRequest("http://localhost/api/calls", {
        method: "POST",
        body: callBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
});
