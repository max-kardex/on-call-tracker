import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/verify/route";
import {
  mockPrisma,
  mockSession,
  mockNoSession,
  createRequest,
} from "../setup";

describe("POST /api/verify", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = createRequest("/api/verify", {
      method: "POST",
      body: JSON.stringify({ code: "A3F9X2K7" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when code is missing", async () => {
    mockSession();
    const req = createRequest("/api/verify", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when no invite code is configured", async () => {
    mockSession();
    mockPrisma.inviteCode.findFirst.mockResolvedValue(null);
    const req = createRequest("/api/verify", {
      method: "POST",
      body: JSON.stringify({ code: "A3F9X2K7" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("No invite code");
  });

  it("returns 403 when code is invalid", async () => {
    mockSession();
    mockPrisma.inviteCode.findFirst.mockResolvedValue({
      id: "ic1",
      code: "A3F9X2K7",
      createdById: "admin-1",
      createdAt: new Date(),
    });
    const req = createRequest("/api/verify", {
      method: "POST",
      body: JSON.stringify({ code: "WRONG123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("verifies user with correct code (case-insensitive)", async () => {
    mockSession({ id: "user-1" });
    mockPrisma.inviteCode.findFirst.mockResolvedValue({
      id: "ic1",
      code: "A3F9X2K7",
      createdById: "admin-1",
      createdAt: new Date(),
    });
    mockPrisma.user.update.mockResolvedValue({ id: "user-1", verified: true });

    const req = createRequest("/api/verify", {
      method: "POST",
      body: JSON.stringify({ code: "a3f9x2k7" }), // lowercase
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { verified: true },
    });
  });
});
