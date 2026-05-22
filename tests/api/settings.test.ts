import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/settings/route";
import { mockPrisma, mockSession, mockAdminSession, mockNoSession } from "../setup";

describe("POST /api/settings", () => {
  it("returns 401 when not authenticated", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        type: "slack",
        webhookUrl: "https://hooks.slack.com/test",
        channelName: "#oncall",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for unknown setting type", async () => {
    mockAdminSession();
    const req = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({ type: "unknown" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown setting type");
  });

  it("creates new Slack config when no id provided", async () => {
    mockAdminSession();
    mockPrisma.slackConfig.create.mockResolvedValue({
      id: "config-1",
      webhookUrl: "https://hooks.slack.com/test",
      channelName: "#oncall",
      notifyOnRotation: true,
      notifyOnSwap: true,
      notifyOnHighSeverity: true,
    });

    const req = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        type: "slack",
        webhookUrl: "https://hooks.slack.com/test",
        channelName: "#oncall",
        notifyOnRotation: true,
        notifyOnSwap: true,
        notifyOnHighSeverity: true,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.slackConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          webhookUrl: "https://hooks.slack.com/test",
          channelName: "#oncall",
          notifyOnRotation: true,
          notifyOnSwap: true,
          notifyOnHighSeverity: true,
        }),
      })
    );
  });

  it("updates existing Slack config when id provided", async () => {
    mockAdminSession();
    mockPrisma.slackConfig.update.mockResolvedValue({
      id: "config-1",
      webhookUrl: "https://hooks.slack.com/updated",
      channelName: "#oncall-new",
      notifyOnRotation: false,
      notifyOnSwap: true,
      notifyOnHighSeverity: true,
    });

    const req = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        type: "slack",
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/updated",
        channelName: "#oncall-new",
        notifyOnRotation: false,
        notifyOnSwap: true,
        notifyOnHighSeverity: true,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.slackConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "config-1" },
        data: expect.objectContaining({
          webhookUrl: "https://hooks.slack.com/updated",
          channelName: "#oncall-new",
        }),
      })
    );
  });

  it("preserves notification toggles on update", async () => {
    mockAdminSession();
    mockPrisma.slackConfig.update.mockResolvedValue({ id: "config-1" });

    const req = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        type: "slack",
        id: "config-1",
        webhookUrl: "https://hooks.slack.com/test",
        channelName: "#oncall",
        notifyOnRotation: true,
        notifyOnSwap: false,
        notifyOnHighSeverity: true,
      }),
    });
    await POST(req);

    expect(mockPrisma.slackConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notifyOnRotation: true,
          notifyOnSwap: false,
          notifyOnHighSeverity: true,
        }),
      })
    );
  });
});
