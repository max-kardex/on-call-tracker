import { describe, it, expect, vi, beforeEach } from "vitest";

// We test api-client in isolation — mock global.fetch directly, don't use the
// shared setup.ts which mocks Prisma/Auth/Slack (server-side concerns).

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import AFTER stubbing fetch
const { api, ApiError } = await import("@/lib/api-client");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(""),
    json: () => Promise.reject(new Error("No body")),
  };
}

function errorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify({ error })),
    json: () => Promise.resolve({ error }),
  };
}

function lastFetchCall() {
  const [url, opts] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return { url, method: opts?.method ?? "GET", headers: opts?.headers, body: opts?.body };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Core request() behaviour ────────────────────────────────────────────────

describe("core request()", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1" }));
    const result = await api.profile.get();
    expect(result).toEqual({ id: "1" });
  });

  it("adds Content-Type header for POST with body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.calls.create({ title: "test" });
    const { headers } = lastFetchCall();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does NOT add Content-Type for GET requests", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await api.holidays.list(2026);
    const { headers } = lastFetchCall();
    expect(headers?.["Content-Type"]).toBeUndefined();
  });

  it("JSON-stringifies the body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.users.updateRoles("u1", ["ADMIN"]);
    const { body } = lastFetchCall();
    expect(JSON.parse(body)).toEqual({ id: "u1", roles: ["ADMIN"] });
  });

  it("throws ApiError with message from response on non-ok", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, "Forbidden"));
    await expect(api.profile.get()).rejects.toThrow(ApiError);
    try {
      mockFetch.mockResolvedValueOnce(errorResponse(400, "Bad request"));
      await api.profile.get();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).status).toBe(400);
      expect((err as InstanceType<typeof ApiError>).message).toBe("Bad request");
    }
  });

  it("throws ApiError with generic message when no .error in body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("not json"),
      json: () => Promise.reject(new Error("parse error")),
    });
    await expect(api.profile.get()).rejects.toThrow("Request failed (500)");
  });

  it("handles empty (204) responses", async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse());
    const result = await api.schedule.delete("s1");
    expect(result).toBeUndefined();
  });
});

// ─── api.schedule ────────────────────────────────────────────────────────────

describe("api.schedule", () => {
  it("fetch() calls GET /api/schedule with from/to params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await api.schedule.fetch("2026-06-01", "2026-06-30");
    const { url, method } = lastFetchCall();
    expect(method).toBe("GET");
    expect(url).toBe("/api/schedule?from=2026-06-01&to=2026-06-30");
  });

  it("selfAssign() calls POST /api/schedule with self-assign action", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "s1" }));
    await api.schedule.selfAssign("2026-06-01");
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("POST");
    expect(url).toBe("/api/schedule");
    expect(JSON.parse(body)).toEqual({ action: "self-assign", weekStart: "2026-06-01" });
  });

  it("generate() calls POST /api/schedule with generate action", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ count: 12 }));
    const result = await api.schedule.generate({
      startDate: "2026-06-01",
      weeks: 12,
      engineerIds: ["e1", "e2"],
    });
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("POST");
    expect(url).toBe("/api/schedule");
    expect(JSON.parse(body)).toEqual({
      action: "generate",
      startDate: "2026-06-01",
      weeks: 12,
      engineerIds: ["e1", "e2"],
    });
    expect(result).toEqual({ count: 12 });
  });

  it("reassign() calls PUT /api/schedule", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.schedule.reassign("s1", "u2");
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("PUT");
    expect(url).toBe("/api/schedule");
    expect(JSON.parse(body)).toEqual({ id: "s1", userId: "u2" });
  });

  it("delete() calls DELETE /api/schedule?id=...", async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse());
    await api.schedule.delete("s1");
    const { url, method } = lastFetchCall();
    expect(method).toBe("DELETE");
    expect(url).toBe("/api/schedule?id=s1");
  });
});

// ─── api.calls ───────────────────────────────────────────────────────────────

describe("api.calls", () => {
  it("create() calls POST /api/calls", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "c1" }));
    await api.calls.create({ title: "Outage", severity: "P1" });
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("POST");
    expect(url).toBe("/api/calls");
    expect(JSON.parse(body)).toEqual({ title: "Outage", severity: "P1" });
  });

  it("delete() calls DELETE /api/calls/:id", async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse());
    await api.calls.delete("c1");
    const { url, method } = lastFetchCall();
    expect(method).toBe("DELETE");
    expect(url).toBe("/api/calls/c1");
  });
});

// ─── api.swaps ───────────────────────────────────────────────────────────────

describe("api.swaps", () => {
  it("create() calls POST /api/swaps", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "sw1" }));
    await api.swaps.create({ postType: "GIVE_AWAY", coverageType: "FULL_WEEK", weekStart: "2026-06-01" });
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("POST");
    expect(url).toBe("/api/swaps");
    expect(JSON.parse(body)).toEqual({
      postType: "GIVE_AWAY",
      coverageType: "FULL_WEEK",
      weekStart: "2026-06-01",
    });
  });

  it("claim() calls PUT /api/swaps/:id with action: claim", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.swaps.claim("sw1", { offeredWeekStart: "2026-07-06" });
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("PUT");
    expect(url).toBe("/api/swaps/sw1");
    expect(JSON.parse(body)).toEqual({ action: "claim", offeredWeekStart: "2026-07-06" });
  });

  it("cancel() calls PUT /api/swaps/:id with action: cancel", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.swaps.cancel("sw1");
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("PUT");
    expect(url).toBe("/api/swaps/sw1");
    expect(JSON.parse(body)).toEqual({ action: "cancel" });
  });
});

// ─── api.compensation ────────────────────────────────────────────────────────

describe("api.compensation", () => {
  it("calculate() calls GET /api/compensation with query params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ compensation: [], periodCap: 24 }));
    const result = await api.compensation.calculate("2026-06-01", "2026-06-30");
    const { url, method } = lastFetchCall();
    expect(method).toBe("GET");
    expect(url).toBe("/api/compensation?action=calculate&periodStart=2026-06-01&periodEnd=2026-06-30");
    expect(result).toEqual({ compensation: [], periodCap: 24 });
  });

  it("saveRules() calls POST /api/compensation", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const rules = [{ name: "P1 Multiplier", ruleType: "severity_multiplier", value: 2 }];
    await api.compensation.saveRules(rules);
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("POST");
    expect(url).toBe("/api/compensation");
    expect(JSON.parse(body)).toEqual({ action: "save_rules", rules });
  });
});

// ─── api.holidays ────────────────────────────────────────────────────────────

describe("api.holidays", () => {
  it("list() calls GET /api/holidays?year=...", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await api.holidays.list(2026);
    const { url, method } = lastFetchCall();
    expect(method).toBe("GET");
    expect(url).toBe("/api/holidays?year=2026");
  });

  it("create() calls POST /api/holidays", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "h1" }));
    await api.holidays.create("2026-12-25", "Christmas");
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("POST");
    expect(url).toBe("/api/holidays");
    expect(JSON.parse(body)).toEqual({ date: "2026-12-25", name: "Christmas" });
  });

  it("delete() calls DELETE /api/holidays?id=...", async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse());
    await api.holidays.delete("h1");
    const { url, method } = lastFetchCall();
    expect(method).toBe("DELETE");
    expect(url).toBe("/api/holidays?id=h1");
  });
});

// ─── api.users ───────────────────────────────────────────────────────────────

describe("api.users", () => {
  it("updateRoles() calls PUT /api/users with id + roles", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.users.updateRoles("u1", ["ADMIN", "ENGINEER"]);
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("PUT");
    expect(url).toBe("/api/users");
    expect(JSON.parse(body)).toEqual({ id: "u1", roles: ["ADMIN", "ENGINEER"] });
  });

  it("toggleActive() calls PUT /api/users with id + isActive", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.users.toggleActive("u1", false);
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("PUT");
    expect(url).toBe("/api/users");
    expect(JSON.parse(body)).toEqual({ id: "u1", isActive: false });
  });
});

// ─── api.profile ─────────────────────────────────────────────────────────────

describe("api.profile", () => {
  it("get() calls GET /api/profile", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ fullName: "John", preferredContact: "SLACK" }));
    const result = await api.profile.get();
    const { url, method } = lastFetchCall();
    expect(method).toBe("GET");
    expect(url).toBe("/api/profile");
    expect(result).toEqual({ fullName: "John", preferredContact: "SLACK" });
  });

  it("update() calls PUT /api/profile", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.profile.update({ fullName: "Jane Doe", preferredContact: "SMS" });
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("PUT");
    expect(url).toBe("/api/profile");
    expect(JSON.parse(body)).toEqual({ fullName: "Jane Doe", preferredContact: "SMS" });
  });
});

// ─── api.settings ────────────────────────────────────────────────────────────

describe("api.settings", () => {
  it("saveSlack() calls POST /api/settings with type: slack", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.settings.saveSlack({
      webhookUrl: "https://hooks.slack.com/test",
      channelName: "#alerts",
      notifyOnRotation: true,
      notifyOnSwap: true,
      notifyOnHighSeverity: false,
    });
    const { url, method, body } = lastFetchCall();
    expect(method).toBe("POST");
    expect(url).toBe("/api/settings");
    const parsed = JSON.parse(body);
    expect(parsed.type).toBe("slack");
    expect(parsed.webhookUrl).toBe("https://hooks.slack.com/test");
    expect(parsed.channelName).toBe("#alerts");
    expect(parsed.notifyOnHighSeverity).toBe(false);
  });
});
