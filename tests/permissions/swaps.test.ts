import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/swaps/route";
import { PUT } from "@/app/api/swaps/[id]/route";
import {
  mockPrisma,
  mockAdminSession,
  mockManagerSession,
  mockSupportSession,
  mockEngineerSession,
  mockMultiRoleSession,
} from "../setup";

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Swap Permissions", () => {
  // ─── Creating swap posts (POST /api/swaps) ─────────────────────────────────
  describe("POST /api/swaps - create swap post", () => {
    const postBody = JSON.stringify({
      postType: "GIVE_AWAY",
      coverageType: "FULL_WEEK",
      weekStart: "2026-06-01",
      reason: "Vacation",
    });

    function mockPosterReady(id: string) {
      mockPrisma.schedule.findFirst.mockResolvedValue({ id: "sched-1", userId: id });
      mockPrisma.swapPost.create.mockResolvedValue({
        id: "sw1",
        posterId: id,
        postType: "GIVE_AWAY",
        coverageType: "FULL_WEEK",
        status: "OPEN",
        poster: { id, name: "Test", fullName: "Test User", email: "t@test.com" },
      });
    }

    it("ENGINEER can create swap post", async () => {
      mockEngineerSession({ id: "user-1" });
      mockPosterReady("user-1");

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: postBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("ADMIN can create swap post", async () => {
      mockAdminSession({ id: "admin-1" });
      mockPosterReady("admin-1");

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: postBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("SUPPORT cannot create swap post", async () => {
      mockSupportSession({ id: "sup-1" });

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: postBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("MANAGER cannot create swap post (without ENGINEER role)", async () => {
      mockManagerSession({ id: "mgr-1" });

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: postBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("MANAGER+ENGINEER can create swap post (multi-role)", async () => {
      mockMultiRoleSession(["MANAGER", "ENGINEER"], { id: "user-1" });
      mockPosterReady("user-1");

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: postBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });
  });

  // ─── Claiming swap posts ──────────────────────────────────────────────────
  describe("PUT /api/swaps/[id] - claim", () => {
    const openPost = {
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      postType: "GIVE_AWAY",
      coverageType: "FULL_WEEK",
      weekStart: new Date("2026-06-01"),
      specificDays: [],
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    };

    function mockPosterSchedule() {
      mockPrisma.schedule.findFirst.mockResolvedValue({
        id: "sched-1",
        userId: "user-1",
        weekStart: new Date("2026-06-01"),
        weekEnd: new Date("2026-06-07"),
      });
      mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CLAIMED" });
      mockPrisma.schedule.update.mockResolvedValue({});
    }

    it("ENGINEER (non-poster) can claim", async () => {
      mockEngineerSession({ id: "user-2", name: "Bob" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);
      mockPosterSchedule();

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "claim" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("ADMIN (non-poster) can claim", async () => {
      mockAdminSession({ id: "admin-1", name: "Admin" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);
      mockPosterSchedule();

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "claim" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("poster cannot claim own post (even if ADMIN)", async () => {
      mockAdminSession({ id: "user-1" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "claim" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot claim", async () => {
      mockSupportSession({ id: "sup-1" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "claim" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });

    it("MANAGER (without ENGINEER role) cannot claim", async () => {
      mockManagerSession({ id: "mgr-1" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "claim" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });
  });

  // ─── Cancelling swap posts ────────────────────────────────────────────────
  describe("PUT /api/swaps/[id] - cancel", () => {
    const openPost = {
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      poster: { id: "user-1", name: "Alice" },
    };

    it("poster can cancel own post", async () => {
      mockEngineerSession({ id: "user-1" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);
      mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CANCELLED" });

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("ADMIN can cancel any post", async () => {
      mockAdminSession({ id: "admin-1" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);
      mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CANCELLED" });

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("MANAGER can cancel any post", async () => {
      mockManagerSession({ id: "mgr-1" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);
      mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CANCELLED" });

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("non-poster ENGINEER cannot cancel", async () => {
      mockEngineerSession({ id: "user-2" });
      mockPrisma.swapPost.findUnique.mockResolvedValue(openPost);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });
  });
});
