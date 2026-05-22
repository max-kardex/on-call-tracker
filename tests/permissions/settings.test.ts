import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/settings/route";
import { POST as CompensationPOST } from "@/app/api/compensation/route";
import {
  mockPrisma,
  mockAdminSession,
  mockManagerSession,
  mockSupportSession,
  mockEngineerSession,
  mockNoSession,
} from "../setup";

describe("Settings & Compensation Permissions", () => {
  // ─── Slack config (POST /api/settings) ──────────────────────────────────────

  describe("POST /api/settings - ADMIN only", () => {
    const slackBody = JSON.stringify({
      type: "slack",
      webhookUrl: "https://hooks.slack.com/test",
      channelName: "#oncall",
      notifyOnRotation: true,
      notifyOnSwap: true,
      notifyOnHighSeverity: true,
    });

    it("ADMIN can manage Slack config", async () => {
      mockAdminSession();
      mockPrisma.slackConfig.create.mockResolvedValue({
        id: "sc1",
        webhookUrl: "https://hooks.slack.com/test",
        channelName: "#oncall",
      });

      const req = new NextRequest("http://localhost/api/settings", {
        method: "POST",
        body: slackBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("MANAGER cannot manage Slack config", async () => {
      mockManagerSession();

      const req = new NextRequest("http://localhost/api/settings", {
        method: "POST",
        body: slackBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });

    it("ENGINEER cannot manage Slack config", async () => {
      mockEngineerSession();

      const req = new NextRequest("http://localhost/api/settings", {
        method: "POST",
        body: slackBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot manage Slack config", async () => {
      mockSupportSession();

      const req = new NextRequest("http://localhost/api/settings", {
        method: "POST",
        body: slackBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("returns 401 when unauthenticated", async () => {
      mockNoSession();

      const req = new NextRequest("http://localhost/api/settings", {
        method: "POST",
        body: slackBody,
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── Compensation rules (POST /api/compensation) ───────────────────────────

  describe("POST /api/compensation - ADMIN only", () => {
    const rulesBody = JSON.stringify({
      action: "save_rules",
      rules: [
        { name: "Base Weekly", ruleType: "base_weekly", value: 4, isActive: true },
      ],
    });

    it("ADMIN can manage compensation rules", async () => {
      mockAdminSession();
      mockPrisma.compensationRule.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.compensationRule.create.mockResolvedValue({
        id: "r1",
        name: "Base Weekly",
        ruleType: "base_weekly",
        value: 4,
        isActive: true,
      });

      const req = new NextRequest("http://localhost/api/compensation", {
        method: "POST",
        body: rulesBody,
      });
      const res = await CompensationPOST(req);
      expect(res.status).toBe(200);
    });

    it("MANAGER cannot manage compensation rules", async () => {
      mockManagerSession();

      const req = new NextRequest("http://localhost/api/compensation", {
        method: "POST",
        body: rulesBody,
      });
      const res = await CompensationPOST(req);
      expect(res.status).toBe(403);
    });

    it("ENGINEER cannot manage compensation rules", async () => {
      mockEngineerSession();

      const req = new NextRequest("http://localhost/api/compensation", {
        method: "POST",
        body: rulesBody,
      });
      const res = await CompensationPOST(req);
      expect(res.status).toBe(403);
    });

    it("SUPPORT cannot manage compensation rules", async () => {
      mockSupportSession();

      const req = new NextRequest("http://localhost/api/compensation", {
        method: "POST",
        body: rulesBody,
      });
      const res = await CompensationPOST(req);
      expect(res.status).toBe(403);
    });
  });
});
