import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/swaps/route";
import { PUT } from "@/app/api/swaps/[id]/route";
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

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Swap Permissions", () => {
  // ─── Creating swap requests (POST /api/swaps) ──────────────────────────────

  describe("POST /api/swaps - create swap request", () => {
    const swapBody = JSON.stringify({
      targetId: "user-2",
      swapType: "FULL_WEEK",
      originalWeekStart: "2026-06-01",
      reason: "Vacation",
    });

    it("ENGINEER can create swap request", async () => {
      mockEngineerSession({ id: "user-1", name: "Alice" });
      mockPrisma.swapRequest.create.mockResolvedValue({
        id: "sw1",
        requesterId: "user-1",
        targetId: "user-2",
        status: "PENDING",
        requester: { id: "user-1", name: "Alice", fullName: "Alice Smith", email: "a@test.com" },
        target: { id: "user-2", name: "Bob", fullName: "Bob Jones", email: "b@test.com" },
      });

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: swapBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("ADMIN can create swap request", async () => {
      mockAdminSession({ id: "admin-1", name: "Admin" });
      mockPrisma.swapRequest.create.mockResolvedValue({
        id: "sw1",
        requesterId: "admin-1",
        targetId: "user-2",
        status: "PENDING",
        requester: { id: "admin-1", name: "Admin", fullName: "Admin User", email: "admin@test.com" },
        target: { id: "user-2", name: "Bob", fullName: "Bob Jones", email: "b@test.com" },
      });

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: swapBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("SUPPORT cannot create swap request", async () => {
      mockSupportSession({ id: "sup-1" });

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: swapBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("MANAGER cannot create swap request (without ENGINEER role)", async () => {
      mockManagerSession({ id: "mgr-1" });

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: swapBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("MANAGER+ENGINEER can create swap request (multi-role)", async () => {
      mockMultiRoleSession(["MANAGER", "ENGINEER"], { id: "user-1", name: "MultiRole" });
      mockPrisma.swapRequest.create.mockResolvedValue({
        id: "sw1",
        requesterId: "user-1",
        targetId: "user-2",
        status: "PENDING",
        requester: { id: "user-1", name: "MultiRole", fullName: "Multi Role", email: "mr@test.com" },
        target: { id: "user-2", name: "Bob", fullName: "Bob Jones", email: "b@test.com" },
      });

      const req = new NextRequest("http://localhost/api/swaps", {
        method: "POST",
        body: swapBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });
  });

  // ─── Approving/Rejecting swap requests (PUT /api/swaps/[id]) ───────────────

  describe("PUT /api/swaps/[id] - approve/reject", () => {
    const pendingSwap = {
      id: "sw1",
      requesterId: "user-1",
      targetId: "user-2",
      status: "PENDING",
      originalWeekStart: new Date("2026-06-01"),
      swapType: "FULL_WEEK",
      requester: { id: "user-1", name: "Alice" },
      target: { id: "user-2", name: "Bob" },
    };

    it("target ENGINEER can approve", async () => {
      mockEngineerSession({ id: "user-2" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);
      mockPrisma.swapRequest.update.mockResolvedValue({ id: "sw1", status: "APPROVED" });
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("target ENGINEER can reject", async () => {
      mockEngineerSession({ id: "user-2" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);
      mockPrisma.swapRequest.update.mockResolvedValue({ id: "sw1", status: "REJECTED" });

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "reject" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("requester cannot approve own request (even if ADMIN)", async () => {
      mockAdminSession({ id: "user-1" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });

    it("requester cannot approve own request (even if MANAGER)", async () => {
      mockManagerSession({ id: "user-1" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });

    it("MANAGER (non-target, non-requester) can approve", async () => {
      mockManagerSession({ id: "mgr-1" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);
      mockPrisma.swapRequest.update.mockResolvedValue({ id: "sw1", status: "APPROVED" });
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("ADMIN (non-target, non-requester) can approve", async () => {
      mockAdminSession({ id: "admin-99" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);
      mockPrisma.swapRequest.update.mockResolvedValue({ id: "sw1", status: "APPROVED" });
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("random ENGINEER (non-target) cannot approve", async () => {
      mockEngineerSession({ id: "user-99" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot approve", async () => {
      mockSupportSession({ id: "sup-1" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot reject", async () => {
      mockSupportSession({ id: "sup-1" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "reject" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });
  });

  // ─── Cancelling swap requests ──────────────────────────────────────────────

  describe("PUT /api/swaps/[id] - cancel", () => {
    const pendingSwap = {
      id: "sw1",
      requesterId: "user-1",
      targetId: "user-2",
      status: "PENDING",
      requester: { id: "user-1" },
      target: { id: "user-2" },
    };

    it("requester can cancel own request", async () => {
      mockEngineerSession({ id: "user-1" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);
      mockPrisma.swapRequest.update.mockResolvedValue({ id: "sw1", status: "CANCELLED" });

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(200);
    });

    it("non-requester cannot cancel (even if ADMIN)", async () => {
      mockAdminSession({ id: "admin-99" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });

    it("target cannot cancel (only requester can)", async () => {
      mockEngineerSession({ id: "user-2" });
      mockPrisma.swapRequest.findUnique.mockResolvedValue(pendingSwap);

      const req = new NextRequest("http://localhost/api/swaps/sw1", {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      const res = await PUT(req, createParams("sw1"));
      expect(res.status).toBe(403);
    });
  });
});
