import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth-guard";

 

// POST /api/settings - Save settings (Slack config)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only ADMIN can manage settings
  if (!hasRole(session, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const { type } = body;

  if (type === "slack") {
    const { id, webhookUrl, channelName, notifyOnRotation, notifyOnSwap, notifyOnHighSeverity } = body;

    if (id) {
      const config = await prisma.slackConfig.update({
        where: { id },
        data: { webhookUrl, channelName, notifyOnRotation, notifyOnSwap, notifyOnHighSeverity },
      });
      return NextResponse.json(config);
    } else {
      const config = await prisma.slackConfig.create({
        data: { webhookUrl, channelName, notifyOnRotation, notifyOnSwap, notifyOnHighSeverity },
      });
      return NextResponse.json(config, { status: 201 });
    }
  }

  if (type === "slack_test") {
    const { webhookUrl } = body;
    if (!webhookUrl) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Test Notification from L3 Support Tracker",
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Test Notification* :white_check_mark:\n\nYour Slack integration with L3 Support Tracker is working correctly.",
            },
          }],
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ error: "Slack webhook returned an error" }, { status: 502 });
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Failed to reach Slack webhook" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown setting type" }, { status: 400 });
}
