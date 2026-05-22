import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/swaps/route";
import { mockPrisma, mockSession, mockNoSession, mockSlack } from "../setup";

describe("GET /api/swaps", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/swaps");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns all swap posts unfiltered", async () => {
    mockSession();
    const posts = [
      {
        id: "sw1",
        status: "OPEN",
        postType: "GIVE_AWAY",
        coverageType: "FULL_WEEK",
        poster: { id: "u1" },
        claimer: null,
      },
    ];
    mockPrisma.swapPost.findMany.mockResolvedValue(posts);

    const req = new NextRequest("http://localhost/api/swaps");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it("filters by status", async () => {
    mockSession();
    mockPrisma.swapPost.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/swaps?status=OPEN");
    await GET(req);

    expect(mockPrisma.swapPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPEN" }),
      })
    );
  });

  it("filters by userId (OR condition for poster/claimer)", async () => {
    mockSession();
    mockPrisma.swapPost.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/swaps?userId=user-1");
    await GET(req);

    expect(mockPrisma.swapPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ posterId: "user-1" }, { claimerId: "user-1" }],
        }),
      })
    );
  });
});

describe("POST /api/swaps", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        postType: "GIVE_AWAY",
        coverageType: "FULL_WEEK",
        weekStart: "2026-06-01",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({ postType: "GIVE_AWAY" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required fields");
  });

  it("returns 400 for invalid postType", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        postType: "BOGUS",
        coverageType: "FULL_WEEK",
        weekStart: "2026-06-01",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when poster has no schedule for the week", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.schedule.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        postType: "GIVE_AWAY",
        coverageType: "FULL_WEEK",
        weekStart: "2026-06-01",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("scheduled week");
  });

  it("creates swap post and returns 201", async () => {
    mockSession({ id: "user-1", name: "Alice" });
    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: "sched-1",
      userId: "user-1",
    });
    mockPrisma.swapPost.create.mockResolvedValue({
      id: "sw1",
      posterId: "user-1",
      postType: "GIVE_AWAY",
      coverageType: "FULL_WEEK",
      status: "OPEN",
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        postType: "GIVE_AWAY",
        coverageType: "FULL_WEEK",
        weekStart: "2026-06-01",
        reason: "Vacation",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("sends Slack notification on post creation", async () => {
    mockSession({ id: "user-1", name: "Alice" });
    mockPrisma.schedule.findFirst.mockResolvedValue({ id: "sched-1", userId: "user-1" });
    mockPrisma.swapPost.create.mockResolvedValue({
      id: "sw1",
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        postType: "SWAP",
        coverageType: "FULL_WEEK",
        weekStart: "2026-06-01",
      }),
    });
    await POST(req);

    expect(mockSlack.notifySwapPost).toHaveBeenCalledWith(
      "Alice A",
      expect.any(String),
      "SWAP",
      "FULL_WEEK",
      undefined
    );
  });

  it("handles SPECIFIC_DAYS coverage", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.schedule.findFirst.mockResolvedValue({ id: "sched-1", userId: "user-1" });
    mockPrisma.swapPost.create.mockResolvedValue({
      id: "sw1",
      poster: { id: "user-1", name: "Alice", fullName: "Alice A", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        postType: "GIVE_AWAY",
        coverageType: "SPECIFIC_DAYS",
        weekStart: "2026-06-01",
        specificDays: ["2026-06-02", "2026-06-03"],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.swapPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coverageType: "SPECIFIC_DAYS",
          specificDays: expect.arrayContaining([expect.any(Date)]),
        }),
      })
    );
  });

  it("returns 400 for SPECIFIC_DAYS missing days array", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.schedule.findFirst.mockResolvedValue({ id: "sched-1", userId: "user-1" });

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        postType: "GIVE_AWAY",
        coverageType: "SPECIFIC_DAYS",
        weekStart: "2026-06-01",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
