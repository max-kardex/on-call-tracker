import { describe, it, expect } from "vitest";
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
      body: JSON.stringify({ action: "claim" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid action", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when swap post not found", async () => {
    mockSession();
    mockPrisma.swapPost.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swaps/nope", {
      method: "PUT",
      body: JSON.stringify({ action: "claim" }),
    });
    const res = await PUT(req, createParams("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when post is not OPEN", async () => {
    mockSession();
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "CLAIMED",
      posterId: "user-2",
      poster: { id: "user-2" },
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "claim" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(400);
  });

  // ─── CANCEL ──────────────────────────────────────────────────────────────
  it("allows poster to cancel own post", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      poster: { id: "user-1" },
    });
    mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CANCELLED" });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.swapPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });

  it("allows ADMIN to cancel any post", async () => {
    mockSession({ id: "admin-1", roles: ["ADMIN"] });
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-2",
      poster: { id: "user-2" },
    });
    mockPrisma.swapPost.update.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
  });

  it("returns 403 when non-poster non-admin tries to cancel", async () => {
    mockSession({ id: "user-3", roles: ["ENGINEER"] });
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-2",
      poster: { id: "user-2" },
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(403);
  });

  // ─── CLAIM ───────────────────────────────────────────────────────────────
  it("returns 403 when poster tries to claim own post", async () => {
    mockSession({ id: "user-1", roles: ["ENGINEER"] });
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      poster: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "claim" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(403);
  });

  it("allows ENGINEER to claim GIVE_AWAY FULL_WEEK post and reassigns schedule", async () => {
    mockSession({ id: "user-2", name: "Bob", email: "b@test.com", roles: ["ENGINEER"] });
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      postType: "GIVE_AWAY",
      coverageType: "FULL_WEEK",
      weekStart: new Date("2026-06-01"),
      specificDays: [],
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });
    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: "sched-1",
      userId: "user-1",
      weekStart: new Date("2026-06-01"),
      weekEnd: new Date("2026-06-07"),
    });
    mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CLAIMED" });
    mockPrisma.schedule.update.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "claim" }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.schedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sched-1" },
        data: expect.objectContaining({ userId: "user-2", isOverride: true }),
      })
    );
  });

  it("returns 400 when SWAP claim is missing offeredWeekStart", async () => {
    mockSession({ id: "user-2", roles: ["ENGINEER"] });
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      postType: "SWAP",
      coverageType: "FULL_WEEK",
      weekStart: new Date("2026-06-01"),
      specificDays: [],
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });
    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: "sched-1",
      userId: "user-1",
      weekStart: new Date("2026-06-01"),
      weekEnd: new Date("2026-06-07"),
    });

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "claim" }),
    });
    const res = await PUT(req, createParams("sw1"));
    expect(res.status).toBe(400);
  });

  it("performs both-direction schedule swap for SWAP FULL_WEEK", async () => {
    mockSession({ id: "user-2", name: "Bob", email: "b@test.com", roles: ["ENGINEER"] });
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      postType: "SWAP",
      coverageType: "FULL_WEEK",
      weekStart: new Date("2026-06-01"),
      specificDays: [],
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });
    mockPrisma.schedule.findFirst
      .mockResolvedValueOnce({
        id: "sched-1",
        userId: "user-1",
        weekStart: new Date("2026-06-01"),
        weekEnd: new Date("2026-06-07"),
      })
      .mockResolvedValueOnce({
        id: "sched-2",
        userId: "user-2",
        weekStart: new Date("2026-07-06"),
        weekEnd: new Date("2026-07-12"),
      });
    mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CLAIMED" });
    mockPrisma.schedule.update.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({
        action: "claim",
        offeredWeekStart: "2026-07-06",
      }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.schedule.update).toHaveBeenCalledTimes(2);
  });

  it("creates DayCoverage records for SPECIFIC_DAYS GIVE_AWAY claim", async () => {
    mockSession({ id: "user-2", name: "Bob", email: "b@test.com", roles: ["ENGINEER"] });
    const day1 = new Date("2026-06-02");
    const day2 = new Date("2026-06-03");
    mockPrisma.swapPost.findUnique.mockResolvedValue({
      id: "sw1",
      status: "OPEN",
      posterId: "user-1",
      postType: "GIVE_AWAY",
      coverageType: "SPECIFIC_DAYS",
      weekStart: new Date("2026-06-01"),
      specificDays: [day1, day2],
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });
    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: "sched-1",
      userId: "user-1",
      weekStart: new Date("2026-06-01"),
      weekEnd: new Date("2026-06-07"),
    });
    mockPrisma.swapPost.update.mockResolvedValue({ id: "sw1", status: "CLAIMED" });
    mockPrisma.dayCoverage.create.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/swaps/sw1", {
      method: "PUT",
      body: JSON.stringify({ action: "claim" }),
    });
    const res = await PUT(req, createParams("sw1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.dayCoverage.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.dayCoverage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-2",
          scheduleId: "sched-1",
          swapPostId: "sw1",
        }),
      })
    );
  });
});
