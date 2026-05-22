import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockFetch } from "../setup";

// For slack.ts tests, we need to test the ACTUAL slack module (not the mock).
// We'll unmock it and re-import, but keep prisma and fetch mocked.
vi.unmock("@/lib/slack");

describe("slack", () => {
  let sendSlackNotification: typeof import("@/lib/slack").sendSlackNotification;
  let notifyRotationReminder: typeof import("@/lib/slack").notifyRotationReminder;
  let notifySwapPost: typeof import("@/lib/slack").notifySwapPost;
  let notifySwapClaimed: typeof import("@/lib/slack").notifySwapClaimed;
  let notifyVolunteer: typeof import("@/lib/slack").notifyVolunteer;
  let notifyHighSeverityCall: typeof import("@/lib/slack").notifyHighSeverityCall;

  beforeEach(async () => {
    vi.clearAllMocks();
    const slack = await import("@/lib/slack");
    sendSlackNotification = slack.sendSlackNotification;
    notifyRotationReminder = slack.notifyRotationReminder;
    notifySwapPost = slack.notifySwapPost;
    notifySwapClaimed = slack.notifySwapClaimed;
    notifyVolunteer = slack.notifyVolunteer;
    notifyHighSeverityCall = slack.notifyHighSeverityCall;
  });

  describe("sendSlackNotification", () => {
    it("skips notification if no active Slack config", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue(null);

      await sendSlackNotification({ text: "Hello" });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends notification to configured webhook URL", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
      });

      await sendSlackNotification({ text: "Hello" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/test",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hello" }),
        })
      );
    });

    it("handles fetch failure gracefully (does not throw)", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
      });
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw
      await expect(sendSlackNotification({ text: "Hello" })).resolves.toBeUndefined();
    });

    it("handles non-ok response gracefully", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
      });
      mockFetch.mockResolvedValueOnce({ ok: false, statusText: "Bad Request" });

      await expect(sendSlackNotification({ text: "Hello" })).resolves.toBeUndefined();
    });
  });

  describe("notifyRotationReminder", () => {
    it("sends rotation reminder with engineer name and week", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
      });

      await notifyRotationReminder("Alice", "2026-06-01");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/test",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Alice"),
        })
      );
    });
  });

  describe("notifySwapPost", () => {
    it("skips if no config with notifyOnSwap enabled", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue(null);

      await notifySwapPost("Alice", "2026-06-01", "GIVE_AWAY", "FULL_WEEK");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends swap post notification when configured", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
        notifyOnSwap: true,
      });

      await notifySwapPost("Alice", "2026-06-01", "GIVE_AWAY", "FULL_WEEK");

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("Alice");
    });
  });

  describe("notifySwapClaimed", () => {
    it("sends claim notification when configured", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
        notifyOnSwap: true,
      });

      await notifySwapClaimed("Bob", "Alice", "2026-06-01", "GIVE_AWAY");

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("Bob");
      expect(body.text).toContain("Alice");
    });
  });

  describe("notifyVolunteer", () => {
    it("skips if no config with notifyOnRotation enabled", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue(null);

      await notifyVolunteer("Alice", "2026-06-01");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends volunteer notification when configured", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
        notifyOnRotation: true,
      });

      await notifyVolunteer("Alice", "2026-06-01");

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("Alice");
      expect(body.text).toContain("2026-06-01");
    });
  });

  describe("notifyHighSeverityCall", () => {
    it("skips if no config with notifyOnHighSeverity enabled", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue(null);

      await notifyHighSeverityCall("Alice", "P1", "Server Down");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends high severity notification when configured", async () => {
      mockPrisma.slackConfig.findFirst.mockResolvedValue({
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        isActive: true,
        notifyOnHighSeverity: true,
      });

      await notifyHighSeverityCall("Alice", "P1", "Server Down");

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("P1");
      expect(body.text).toContain("Server Down");
      expect(body.text).toContain("Alice");
    });
  });
});
