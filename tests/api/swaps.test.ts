import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("returns all swap requests unfiltered", async () => {
    mockSession();
    const swaps = [
      { id: "sw1", status: "PENDING", requester: { id: "u1" }, target: { id: "u2" } },
    ];
    mockPrisma.swapRequest.findMany.mockResolvedValue(swaps);

    const req = new NextRequest("http://localhost/api/swaps");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it("filters by status", async () => {
    mockSession();
    mockPrisma.swapRequest.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/swaps?status=PENDING");
    await GET(req);

    expect(mockPrisma.swapRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING" }),
      })
    );
  });

  it("filters by userId (OR condition for requester/target)", async () => {
    mockSession();
    mockPrisma.swapRequest.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/swaps?userId=user-1");
    await GET(req);

    expect(mockPrisma.swapRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ requesterId: "user-1" }, { targetId: "user-1" }],
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
        targetId: "u2",
        swapType: "FULL_WEEK",
        originalWeekStart: "2026-06-01",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    mockSession();
    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({ targetId: "u2" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required fields");
  });

  it("returns 400 when trying to swap with self", async () => {
    mockSession({ id: "user-1" });
    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        targetId: "user-1",
        swapType: "FULL_WEEK",
        originalWeekStart: "2026-06-01",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Cannot swap with yourself");
  });

  it("creates swap request and returns 201", async () => {
    mockSession({ id: "user-1", name: "Alice" });
    mockPrisma.swapRequest.create.mockResolvedValue({
      id: "sw1",
      requesterId: "user-1",
      targetId: "user-2",
      swapType: "FULL_WEEK",
      status: "PENDING",
      requester: { id: "user-1", name: "Alice", email: "a@test.com" },
      target: { id: "user-2", name: "Bob", email: "b@test.com" },
    });

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        targetId: "user-2",
        swapType: "FULL_WEEK",
        originalWeekStart: "2026-06-01",
        reason: "Vacation",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("sends Slack notification on swap creation", async () => {
    mockSession({ id: "user-1", name: "Alice" });
    mockPrisma.swapRequest.create.mockResolvedValue({
      id: "sw1",
      requester: { id: "user-1", name: "Alice", email: "a@test.com" },
      target: { id: "user-2", name: "Bob", email: "b@test.com" },
    });

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        targetId: "user-2",
        swapType: "FULL_WEEK",
        originalWeekStart: "2026-06-01",
      }),
    });
    await POST(req);

    expect(mockSlack.notifySwapRequest).toHaveBeenCalledWith(
      "Alice",
      "Bob",
      expect.any(String)
    );
  });

  it("handles specificDays for SPECIFIC_DAYS swap type", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.swapRequest.create.mockResolvedValue({
      id: "sw1",
      requester: { id: "user-1", name: "Alice", email: "a@test.com" },
      target: { id: "user-2", name: "Bob", email: "b@test.com" },
    });

    const req = new NextRequest("http://localhost/api/swaps", {
      method: "POST",
      body: JSON.stringify({
        targetId: "user-2",
        swapType: "SPECIFIC_DAYS",
        originalWeekStart: "2026-06-01",
        specificDays: ["2026-06-02", "2026-06-03"],
      }),
    });
    await POST(req);

    expect(mockPrisma.swapRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          swapType: "SPECIFIC_DAYS",
          specificDays: expect.arrayContaining([expect.any(Date)]),
        }),
      })
    );
  });
});
