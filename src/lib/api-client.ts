/**
 * Client-side API abstraction layer.
 *
 * All client components MUST use these functions instead of raw `fetch()`.
 * See AGENTS.md "Client-Side API Calls" for the convention.
 */

// ─── Core ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function request<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = { ...(customHeaders as Record<string, string>) };

  // Auto-add Content-Type for non-GET requests with a body
  if (body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      // Response body wasn't JSON — keep the generic message
    }
    throw new ApiError(res.status, message);
  }

  // Handle empty responses (204, etc.)
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Domain Functions ────────────────────────────────────────────────────────

export const api = {
  // ── Schedule ─────────────────────────────────────────────────────────────
  schedule: {
    /** Fetch schedules for a date range (calendar view). */
    fetch: (from: string, to: string) =>
      request<any[]>(`/api/schedule?from=${from}&to=${to}`),

    /** Self-assign the current user to an open week. */
    selfAssign: (weekStart: string) =>
      request("/api/schedule", {
        method: "POST",
        body: { action: "self-assign", weekStart },
      }),

    /** Generate a round-robin rotation. */
    generate: (data: { startDate: string; weeks: number; engineerIds: string[] }) =>
      request<{ count: number }>("/api/schedule", {
        method: "POST",
        body: { action: "generate", ...data },
      }),

    /** Reassign a schedule entry to another user (admin). */
    reassign: (id: string, userId: string) =>
      request("/api/schedule", {
        method: "PUT",
        body: { id, userId },
      }),

    /** Delete a schedule entry. */
    delete: (id: string) =>
      request(`/api/schedule?id=${id}`, { method: "DELETE" }),
  },

  // ── Calls ────────────────────────────────────────────────────────────────
  calls: {
    /** Log a new on-call incident. */
    create: (data: Record<string, unknown>) =>
      request("/api/calls", { method: "POST", body: data }),

    /** Delete a call log entry. */
    delete: (id: string) =>
      request(`/api/calls/${id}`, { method: "DELETE" }),
  },

  // ── Swaps ────────────────────────────────────────────────────────────────
  swaps: {
    /** Create a new swap/give-away post. */
    create: (data: Record<string, unknown>) =>
      request("/api/swaps", { method: "POST", body: data }),

    /** Claim a swap post. */
    claim: (id: string, data: Record<string, unknown> = {}) =>
      request(`/api/swaps/${id}`, {
        method: "PUT",
        body: { action: "claim", ...data },
      }),

    /** Cancel a swap post. */
    cancel: (id: string) =>
      request(`/api/swaps/${id}`, {
        method: "PUT",
        body: { action: "cancel" },
      }),
  },

  // ── Compensation ─────────────────────────────────────────────────────────
  compensation: {
    /** Calculate PTO compensation for a period. */
    calculate: (periodStart: string, periodEnd: string) =>
      request<{ compensation: unknown[]; periodCap: number }>(
        `/api/compensation?action=calculate&periodStart=${periodStart}&periodEnd=${periodEnd}`
      ),

    /** Save compensation rules (admin). */
    saveRules: (rules: Record<string, unknown>[]) =>
      request("/api/compensation", {
        method: "POST",
        body: { action: "save_rules", rules },
      }),
  },

  // ── Holidays ─────────────────────────────────────────────────────────────
  holidays: {
    /** List holidays for a year. */
    list: (year: number) =>
      request<{ id: string; date: string; name: string; isCustom: boolean }[]>(
        `/api/holidays?year=${year}`
      ),

    /** Add a custom holiday. */
    create: (date: string, name: string) =>
      request("/api/holidays", { method: "POST", body: { date, name } }),

    /** Remove a holiday. */
    delete: (id: string) =>
      request(`/api/holidays?id=${id}`, { method: "DELETE" }),
  },

  // ── Users ────────────────────────────────────────────────────────────────
  users: {
    /** Update a user's roles (admin). */
    updateRoles: (id: string, roles: string[]) =>
      request("/api/users", { method: "PUT", body: { id, roles } }),

    /** Toggle a user's active status (admin). */
    toggleActive: (id: string, isActive: boolean) =>
      request("/api/users", { method: "PUT", body: { id, isActive } }),
  },

  // ── Profile ──────────────────────────────────────────────────────────────
  profile: {
    /** Get the current user's profile. */
    get: () => request<{ fullName: string | null; preferredContact: string }>("/api/profile"),

    /** Update the current user's profile. */
    update: (data: Record<string, unknown>) =>
      request("/api/profile", { method: "PUT", body: data }),
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: {
    /** Save Slack webhook configuration (admin). */
    saveSlack: (config: object) =>
      request("/api/settings", {
        method: "POST",
        body: { type: "slack", ...config },
      }),

    /** Send a test notification to verify Slack webhook. */
    testSlack: (webhookUrl: string) =>
      request("/api/settings", {
        method: "POST",
        body: { type: "slack_test", webhookUrl },
      }),
  },

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: {
    /** List current user's notifications. */
    list: (params?: { unread?: boolean; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.unread) query.set("unread", "true");
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      return request<{ notifications: any[]; unreadCount: number }>(
        `/api/notifications${qs ? `?${qs}` : ""}`
      );
    },

    /** Mark a single notification as read. */
    markRead: (id: string) =>
      request(`/api/notifications/${id}`, { method: "PUT", body: { read: true } }),

    /** Mark all notifications as read. */
    markAllRead: () =>
      request("/api/notifications", { method: "PUT", body: { action: "mark_all_read" } }),
  },
};
