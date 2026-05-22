import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/settings - Save settings (Slack config)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  return NextResponse.json({ error: "Unknown setting type" }, { status: 400 });
}
