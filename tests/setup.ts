import { vi } from "vitest";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

function createMockModel() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  };
}

export const mockPrisma = {
  user: createMockModel(),
  schedule: createMockModel(),
  callLog: createMockModel(),
  swapRequest: createMockModel(),
  ptoCompensation: createMockModel(),
  compensationRule: createMockModel(),
  slackConfig: createMockModel(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ─── Mock Auth ───────────────────────────────────────────────────────────────

export const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// ─── Mock Slack ──────────────────────────────────────────────────────────────

export const mockSlack = {
  sendSlackNotification: vi.fn().mockResolvedValue(undefined),
  notifyRotationReminder: vi.fn().mockResolvedValue(undefined),
  notifySwapRequest: vi.fn().mockResolvedValue(undefined),
  notifyVolunteer: vi.fn().mockResolvedValue(undefined),
  notifyHighSeverityCall: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/slack", () => mockSlack);

// ─── Mock fetch (for Slack webhook tests) ────────────────────────────────────

export const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  statusText: "OK",
});

vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function mockSession(user: Record<string, unknown> = {}) {
  const defaultUser = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "ENGINEER",
    ...user,
  };
  mockAuth.mockResolvedValue({ user: defaultUser });
  return defaultUser;
}

export function mockAdminSession(user: Record<string, unknown> = {}) {
  return mockSession({ role: "ADMIN", ...user });
}

export function mockNoSession() {
  mockAuth.mockResolvedValue(null);
}

/**
 * Create a NextRequest for testing route handlers.
 */
export function createRequest(
  url: string,
  options: RequestInit = {}
): Request {
  return new Request(`http://localhost${url}`, options);
}

// ─── Reset mocks between tests ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});
