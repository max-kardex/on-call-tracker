import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/profile/route";
import { mockPrisma, mockSession, mockNoSession, mockAuth } from "../setup";

describe("GET /api/profile", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/profile");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found in DB", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns user profile data", async () => {
    mockSession({ id: "user-1" });
    const user = {
      id: "user-1",
      name: "alice",
      fullName: "Alice Smith",
      email: "alice@test.com",
      image: null,
      roles: ["ENGINEER"],
      preferredContact: "SLACK",
      onboarded: true,
      createdAt: new Date("2026-01-01"),
    };
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.fullName).toBe("Alice Smith");
    expect(data.preferredContact).toBe("SLACK");
  });
});

describe("PUT /api/profile", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({ fullName: "Test" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no valid fields to update", async () => {
    mockSession({ id: "user-1" });
    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({ invalidField: "value" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No valid fields");
  });

  it("trims fullName whitespace", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      fullName: "Alice Smith",
    });

    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({ fullName: "  Alice Smith  " }),
    });
    await PUT(req);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fullName: "Alice Smith" }),
      })
    );
  });

  it("rejects empty fullName (whitespace only)", async () => {
    mockSession({ id: "user-1" });
    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({ fullName: "   " }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("accepts valid contact methods", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.user.update.mockResolvedValue({ id: "user-1", preferredContact: "TEAMS" });

    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({ preferredContact: "TEAMS" }),
    });
    const res = await PUT(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ preferredContact: "TEAMS" }),
      })
    );
  });

  it("rejects invalid contact methods", async () => {
    mockSession({ id: "user-1" });
    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({ preferredContact: "PIGEON" }),
    });
    const res = await PUT(req);
    // "PIGEON" is not valid, so no updateData fields — returns 400
    expect(res.status).toBe(400);
  });

  it("updates onboarded flag", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.user.update.mockResolvedValue({ id: "user-1", onboarded: true });

    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({ onboarded: true }),
    });
    await PUT(req);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onboarded: true }),
      })
    );
  });

  it("updates multiple fields at once", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      fullName: "Alice",
      preferredContact: "CALL",
      onboarded: true,
    });

    const req = new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName: "Alice",
        preferredContact: "CALL",
        onboarded: true,
      }),
    });
    await PUT(req);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          fullName: "Alice",
          preferredContact: "CALL",
          onboarded: true,
        },
      })
    );
  });
});
