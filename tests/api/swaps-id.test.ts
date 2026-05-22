import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/swaps/[id]/route";
import { mockPrisma, mockSession, mockNoSession } from "../setup";

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PUT /api/swaps/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid action", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "invalid" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid action");
  });

  it("returns 400 when action is missing", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({}),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when swap not found", async () => {
    mockSession();
    mockPrisma.swapRequest.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swaps/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(req, createParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-target tries to approve", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.swapRequest.findUnique.mockResolvedValue({
      id: "sw1",
      requesterId: "user-2",
      targetId: "user-3",
      requester: { id: "user-2" },
      target: { id: "user-3" },
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Only the target can approve");
  });

  it("returns 403 when non-target tries to reject", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.swapRequest.findUnique.mockResolvedValue({
      id: "sw1",
      requesterId: "user-2",
      targetId: "user-3",
      requester: { id: "user-2" },
      target: { id: "user-3" },
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "reject" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when non-requester tries to cancel", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.swapRequest.findUnique.mockResolvedValue({
      id: "sw1",
      requesterId: "user-2",
      targetId: "user-1",
      requester: { id: "user-2" },
      target: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Only the requester can cancel");
  });

  it("allows target to approve", async () => {
    mockSession({ id: "user-2" });
    mockPrisma.swapRequest.findUnique.mockResolvedValue({
      id: "sw1",
      requesterId: "user-1",
      targetId: "user-2",
      originalWeekStart: new Date("2026-06-01"),
      swapType: "FULL_WEEK",
      requester: { id: "user-1" },
      target: { id: "user-2" },
    });
    mockPrisma.swapRequest.update.mockResolvedValue({
      id: "sw1",
      status: "APPROVED",
    });
    // Mock schedule lookups for performScheduleSwap
    mockPrisma.schedule.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.swapRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          respondedAt: expect.any(Date),
        }),
      })
    );
  });

  it("allows target to reject", async () => {
    mockSession({ id: "user-2" });
    mockPrisma.swapRequest.findUnique.mockResolvedValue({
      id: "sw1",
      requesterId: "user-1",
      targetId: "user-2",
      requester: { id: "user-1" },
      target: { id: "user-2" },
    });
    mockPrisma.swapRequest.update.mockResolvedValue({
      id: "sw1",
      status: "REJECTED",
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "reject", responseNote: "Sorry, busy that week" }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.swapRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          responseNote: "Sorry, busy that week",
        }),
      })
    );
  });

  it("allows requester to cancel", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.swapRequest.findUnique.mockResolvedValue({
      id: "sw1",
      requesterId: "user-1",
      targetId: "user-2",
      requester: { id: "user-1" },
      target: { id: "user-2" },
    });
    mockPrisma.swapRequest.update.mockResolvedValue({
      id: "sw1",
      status: "CANCELLED",
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.swapRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });

  it("performs schedule swap on approve (full week)", async () => {
    mockSession({ id: "user-2" });
    mockPrisma.swapRequest.findUnique.mockResolvedValue({
      id: "sw1",
      requesterId: "user-1",
      targetId: "user-2",
      originalWeekStart: new Date("2026-06-01"),
      swapType: "FULL_WEEK",
      requester: { id: "user-1" },
      target: { id: "user-2" },
    });
    mockPrisma.swapRequest.update.mockResolvedValue({ id: "sw1", status: "APPROVED" });

    // Requester has a schedule entry for that week
    mockPrisma.schedule.findFirst
      .mockResolvedValueOnce({ id: "sched-1", userId: "user-1" }) // requester's schedule
      .mockResolvedValueOnce({ id: "sched-2", userId: "user-2" }); // target's schedule

    mockPrisma.schedule.update.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    await PUT(req, createParams("sw1"));

    // Should swap both schedules
    expect(mockPrisma.schedule.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.schedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sched-1" },
        data: expect.objectContaining({
          userId: "user-2",
          isOverride: true,
        }),
      })
    );
    expect(mockPrisma.schedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sched-2" },
        data: expect.objectContaining({
          userId: "user-1",
          isOverride: true,
        }),
      })
    );
  });
});
