import { describe, it, expect, vi } from "vitest";
import { GET, POST } from "@/app/api/calendar-token/route";
import {
  mockPrisma,
  mockAdminSession,
  mockSession,
  mockNoSession,
} from "../setup";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(
    new Map([
      ["host", "localhost:3000"],
      ["x-forwarded-proto", "https"],
    ]) as any
  ),
}));

describe("GET /api/calendar-token", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockSession({ roles: ["ENGINEER"] });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns null when no token exists", async () => {
    mockAdminSession();
    mockPrisma.calendarToken.findFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeNull();
    expect(data.url).toBeNull();
  });

  it("returns the token and URL for admins", async () => {
    mockAdminSession();
    mockPrisma.calendarToken.findFirst.mockResolvedValue({
      id: "ct1",
      token: "abcdef1234567890abcdef1234567890",
      createdAt: new Date("2026-01-01"),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe("abcdef1234567890abcdef1234567890");
    expect(data.url).toContain("/api/schedule/calendar.ics?token=");
  });
});

describe("POST /api/calendar-token", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockSession({ roles: ["ENGINEER"] });
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("generates a new 32-char hex token for admins", async () => {
    mockAdminSession();
    mockPrisma.$transaction.mockResolvedValue(undefined);

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.token.length).toBe(32);
    // Should be hex characters
    expect(data.token).toMatch(/^[0-9a-f]+$/);
    expect(data.url).toContain("/api/schedule/calendar.ics?token=");
  });
});
