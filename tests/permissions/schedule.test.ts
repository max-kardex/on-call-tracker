import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST, PUT, DELETE } from "@/app/api/schedule/route";
import {
  mockPrisma,
  mockSession,
  mockAdminSession,
  mockManagerSession,
  mockSupportSession,
  mockEngineerSession,
  mockMultiRoleSession,
  mockNoSession,
  mockSlack,
} from "../setup";

describe("Schedule Permissions", () => {
  // ─── Self-assign ────────────────────────────────────────────────────────────

  describe("POST /api/schedule (self-assign)", () => {
    const selfAssignBody = JSON.stringify({ action: "self-assign", weekStart: "2027-06-07" });

    it("ENGINEER can self-assign", async () => {
      mockEngineerSession({ id: "user-1", name: "Alice" });
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.schedule.create.mockResolvedValue({
        id: "s1",
        userId: "user-1",
        isSelfAssigned: true,
        user: { id: "user-1", name: "Alice", email: "alice@test.com", image: null },
      });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: selfAssignBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("ADMIN can self-assign", async () => {
      mockAdminSession({ id: "admin-1", name: "Admin" });
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.schedule.create.mockResolvedValue({
        id: "s1",
        userId: "admin-1",
        isSelfAssigned: true,
        user: { id: "admin-1", name: "Admin", email: "admin@test.com", image: null },
      });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: selfAssignBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("MANAGER cannot self-assign (without ENGINEER role)", async () => {
      mockManagerSession({ id: "mgr-1" });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: selfAssignBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot self-assign", async () => {
      mockSupportSession({ id: "sup-1" });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: selfAssignBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("MANAGER+ENGINEER can self-assign (multi-role)", async () => {
      mockMultiRoleSession(["MANAGER", "ENGINEER"], { id: "user-1", name: "MultiRole" });
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.schedule.create.mockResolvedValue({
        id: "s1",
        userId: "user-1",
        isSelfAssigned: true,
        user: { id: "user-1", name: "MultiRole", email: "multi@test.com", image: null },
      });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: selfAssignBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── Generate rotation ──────────────────────────────────────────────────────

  describe("POST /api/schedule (generate rotation)", () => {
    const generateBody = JSON.stringify({
      action: "generate",
      startDate: "2027-06-01",
      weeks: 3,
      engineerIds: ["u1", "u2", "u3"],
    });

    it("ADMIN can generate rotation", async () => {
      mockAdminSession();
      mockPrisma.schedule.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.schedule.upsert.mockImplementation(async (args: any) => ({
        ...args.create,
        id: "generated-id",
        user: { id: args.create.userId, name: "User", email: "u@test.com" },
      }));

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: generateBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.count).toBe(3);
    });

    it("MANAGER can generate rotation", async () => {
      mockManagerSession();
      mockPrisma.schedule.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.schedule.upsert.mockImplementation(async (args: any) => ({
        ...args.create,
        id: "generated-id",
        user: { id: args.create.userId, name: "User", email: "u@test.com" },
      }));

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: generateBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("ENGINEER cannot generate rotation", async () => {
      mockEngineerSession();

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: generateBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot generate rotation", async () => {
      mockSupportSession();

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: generateBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── Create entry for others ────────────────────────────────────────────────

  describe("POST /api/schedule (create entry for others)", () => {
    const createBody = JSON.stringify({ userId: "u1", weekStart: "2027-06-01" });

    it("MANAGER can create entry for others", async () => {
      mockManagerSession();
      mockPrisma.schedule.create.mockResolvedValue({
        id: "s1",
        userId: "u1",
        isOverride: true,
        isSelfAssigned: false,
        user: { id: "u1", name: "Alice", email: "a@test.com" },
      });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: createBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("ADMIN can create entry for others", async () => {
      mockAdminSession();
      mockPrisma.schedule.create.mockResolvedValue({
        id: "s1",
        userId: "u1",
        isOverride: true,
        isSelfAssigned: false,
        user: { id: "u1", name: "Alice", email: "a@test.com" },
      });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: createBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("ENGINEER cannot create entry for others", async () => {
      mockEngineerSession();

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: createBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot create entry for others", async () => {
      mockSupportSession();

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "POST",
        body: createBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── Update schedule (PUT) ──────────────────────────────────────────────────

  describe("PUT /api/schedule", () => {
    const putBody = JSON.stringify({ id: "s1", userId: "u2" });

    it("MANAGER can update schedule", async () => {
      mockManagerSession();
      mockPrisma.schedule.update.mockResolvedValue({
        id: "s1",
        userId: "u2",
        isOverride: true,
        isSelfAssigned: false,
        user: { id: "u2", name: "Bob", email: "b@test.com" },
      });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "PUT",
        body: putBody,
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
    });

    it("ADMIN can update schedule", async () => {
      mockAdminSession();
      mockPrisma.schedule.update.mockResolvedValue({
        id: "s1",
        userId: "u2",
        isOverride: true,
        isSelfAssigned: false,
        user: { id: "u2", name: "Bob", email: "b@test.com" },
      });

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "PUT",
        body: putBody,
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
    });

    it("ENGINEER cannot update schedule", async () => {
      mockEngineerSession();

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "PUT",
        body: putBody,
      });
      const res = await PUT(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot update schedule", async () => {
      mockSupportSession();

      const req = new NextRequest("http://localhost/api/schedule", {
        method: "PUT",
        body: putBody,
      });
      const res = await PUT(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── Delete schedule ────────────────────────────────────────────────────────

  describe("DELETE /api/schedule", () => {
    it("ADMIN can delete any entry", async () => {
      mockAdminSession();
      mockPrisma.schedule.delete.mockResolvedValue({ id: "s1" });

      const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
    });

    it("MANAGER can delete any entry", async () => {
      mockManagerSession();
      mockPrisma.schedule.delete.mockResolvedValue({ id: "s1" });

      const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
    });

    it("ENGINEER can delete own self-assigned entry", async () => {
      mockEngineerSession({ id: "user-1" });
      mockPrisma.schedule.findUnique.mockResolvedValue({
        id: "s1",
        userId: "user-1",
        isSelfAssigned: true,
      });
      mockPrisma.schedule.delete.mockResolvedValue({ id: "s1" });

      const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
    });

    it("ENGINEER cannot delete others' entries", async () => {
      mockEngineerSession({ id: "user-1" });
      mockPrisma.schedule.findUnique.mockResolvedValue({
        id: "s1",
        userId: "user-2",
        isSelfAssigned: true,
      });

      const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(403);
    });

    it("ENGINEER cannot delete own non-self-assigned entry", async () => {
      mockEngineerSession({ id: "user-1" });
      mockPrisma.schedule.findUnique.mockResolvedValue({
        id: "s1",
        userId: "user-1",
        isSelfAssigned: false,
      });

      const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot delete", async () => {
      mockSupportSession({ id: "sup-1" });
      mockPrisma.schedule.findUnique.mockResolvedValue({
        id: "s1",
        userId: "sup-1",
        isSelfAssigned: true,
      });

      const req = new NextRequest("http://localhost/api/schedule?id=s1", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(403);
    });
  });
});
