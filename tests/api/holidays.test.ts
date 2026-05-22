import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/holidays/route";
import {
  mockPrisma,
  mockSession,
  mockAdminSession,
  mockNoSession,
  mockEngineerSession,
} from "../setup";

describe("GET /api/holidays", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/holidays");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns federal + custom holidays for the year", async () => {
    mockSession();
    mockPrisma.holiday.findMany.mockResolvedValue([
      { id: "h1", date: new Date("2026-03-15T12:00:00"), name: "Company Day", isCustom: true },
    ]);

    const req = new NextRequest("http://localhost/api/holidays?year=2026");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // 11 federal + 1 custom = 12
    expect(data.length).toBe(12);

    // Check federal holidays are marked correctly
    const newYear = data.find((h: any) => h.name === "New Year's Day");
    expect(newYear).toBeDefined();
    expect(newYear.isCustom).toBe(false);

    // Check custom holiday is marked correctly
    const companyDay = data.find((h: any) => h.name === "Company Day");
    expect(companyDay).toBeDefined();
    expect(companyDay.isCustom).toBe(true);
  });

  it("returns only federal holidays when no custom exist", async () => {
    mockSession();
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/holidays?year=2026");
    const res = await GET(req);
    const data = await res.json();

    expect(data.length).toBe(11); // Only federal holidays
  });

  it("defaults to current year if no year specified", async () => {
    mockSession();
    mockPrisma.holiday.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/holidays");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.holiday.findMany).toHaveBeenCalled();
  });
});

describe("POST /api/holidays", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/holidays", {
      method: "POST",
      body: JSON.stringify({ date: "2026-06-10", name: "Company Day" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockEngineerSession();
    const req = new NextRequest("http://localhost/api/holidays", {
      method: "POST",
      body: JSON.stringify({ date: "2026-06-10", name: "Company Day" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates a custom holiday", async () => {
    mockAdminSession();
    mockPrisma.holiday.findUnique.mockResolvedValue(null);
    mockPrisma.holiday.create.mockResolvedValue({
      id: "h1",
      date: new Date("2026-06-10T12:00:00"),
      name: "Company Day",
      isCustom: true,
    });

    const req = new NextRequest("http://localhost/api/holidays", {
      method: "POST",
      body: JSON.stringify({ date: "2026-06-10", name: "Company Day" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("Company Day");
    expect(data.isCustom).toBe(true);
  });

  it("returns 400 if date or name is missing", async () => {
    mockAdminSession();

    const req = new NextRequest("http://localhost/api/holidays", {
      method: "POST",
      body: JSON.stringify({ date: "2026-06-10" }), // no name
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 if holiday already exists on that date", async () => {
    mockAdminSession();
    mockPrisma.holiday.findUnique.mockResolvedValue({
      id: "h1",
      date: new Date("2026-06-10T12:00:00"),
      name: "Existing",
      isCustom: true,
    });

    const req = new NextRequest("http://localhost/api/holidays", {
      method: "POST",
      body: JSON.stringify({ date: "2026-06-10", name: "Duplicate" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/holidays", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/holidays?id=h1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockEngineerSession();
    const req = new NextRequest("http://localhost/api/holidays?id=h1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 if no id provided", async () => {
    mockAdminSession();
    const req = new NextRequest("http://localhost/api/holidays", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 if holiday not found", async () => {
    mockAdminSession();
    mockPrisma.holiday.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/holidays?id=nonexistent", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("deletes a custom holiday", async () => {
    mockAdminSession();
    mockPrisma.holiday.findUnique.mockResolvedValue({
      id: "h1",
      date: new Date("2026-06-10T12:00:00"),
      name: "Company Day",
      isCustom: true,
    });
    mockPrisma.holiday.delete.mockResolvedValue({ id: "h1" });

    const req = new NextRequest("http://localhost/api/holidays?id=h1", { method: "DELETE" });
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.holiday.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
  });

  it("cannot delete non-custom holidays", async () => {
    mockAdminSession();
    mockPrisma.holiday.findUnique.mockResolvedValue({
      id: "h1",
      date: new Date("2026-07-04T12:00:00"),
      name: "Independence Day",
      isCustom: false,
    });

    const req = new NextRequest("http://localhost/api/holidays?id=h1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
