import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "@/app/api/calls/[id]/route";
import { mockPrisma, mockSession, mockNoSession } from "../setup";

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/calls/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/calls/c1");
    const res = await GET(req, createParams("c1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when call not found", async () => {
    mockSession();
    mockPrisma.callLog.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/calls/nonexistent");
    const res = await GET(req, createParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns call with user and schedule details", async () => {
    mockSession();
    const call = {
      id: "c1",
      severity: "P2",
      title: "Test call",
      user: { id: "u1", name: "Alice", email: "a@test.com", image: null },
      schedule: { id: "s1", weekStart: new Date("2026-06-01"), weekEnd: new Date("2026-06-07") },
    };
    mockPrisma.callLog.findUnique.mockResolvedValue(call);

    const req = new NextRequest("http://localhost/api/calls/c1");
    const res = await GET(req, createParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("c1");
    expect(data.user.name).toBe("Alice");
  });
});

describe("PUT /api/calls/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/calls/c1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PUT(req, createParams("c1"));
    expect(res.status).toBe(401);
  });

  it("recalculates duration when both times provided", async () => {
    mockSession();
    mockPrisma.callLog.update.mockResolvedValue({
      id: "c1",
      duration: 45,
      user: { id: "u1", name: "Alice", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls/c1", {
      method: "PUT",
      body: JSON.stringify({
        startTime: "2026-06-15T10:00:00",
        endTime: "2026-06-15T10:45:00",
      }),
    });
    await PUT(req, createParams("c1"));

    expect(mockPrisma.callLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duration: 45,
        }),
      })
    );
  });

  it("performs partial update (only severity)", async () => {
    mockSession();
    mockPrisma.callLog.update.mockResolvedValue({
      id: "c1",
      severity: "P1",
      user: { id: "u1", name: "Alice", email: "a@test.com" },
    });

    const req = new NextRequest("http://localhost/api/calls/c1", {
      method: "PUT",
      body: JSON.stringify({ severity: "P1" }),
    });
    const res = await PUT(req, createParams("c1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.callLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ severity: "P1" }),
      })
    );
  });
});

describe("DELETE /api/calls/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/calls/c1", { method: "DELETE" });
    const res = await DELETE(req, createParams("c1"));
    expect(res.status).toBe(401);
  });

  it("deletes the call and returns success", async () => {
    mockSession();
    mockPrisma.callLog.delete.mockResolvedValue({ id: "c1" });

    const req = new NextRequest("http://localhost/api/calls/c1", { method: "DELETE" });
    const res = await DELETE(req, createParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.callLog.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
