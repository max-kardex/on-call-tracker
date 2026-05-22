import { prisma } from "@/lib/prisma";

interface SlackMessage {
  text: string;
  blocks?: Record<string, unknown>[];
}

export async function sendSlackNotification(message: SlackMessage) {
  const config = await prisma.slackConfig.findFirst({
    where: { isActive: true },
  });

  if (!config) {
    console.log("Slack not configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error("Slack notification failed:", response.statusText);
    }
  } catch (error) {
    console.error("Slack notification error:", error);
  }
}

export async function notifyRotationReminder(engineerName: string, weekStart: string) {
  await sendSlackNotification({
    text: `Rotation Reminder: ${engineerName} is on-call starting ${weekStart}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*On-Call Rotation Reminder* :rotating_light:\n\n*${engineerName}* is on-call starting *${weekStart}*.\n\nGood luck this week!`,
        },
      },
    ],
  });
}

export async function notifySwapRequest(
  requesterName: string,
  targetName: string,
  weekStart: string
) {
  const config = await prisma.slackConfig.findFirst({
    where: { isActive: true, notifyOnSwap: true },
  });
  if (!config) return;

  await sendSlackNotification({
    text: `Swap Request: ${requesterName} wants to swap on-call with ${targetName} for week of ${weekStart}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*On-Call Swap Request* :arrows_counterclockwise:\n\n*${requesterName}* is requesting to swap on-call with *${targetName}* for the week of *${weekStart}*.\n\nPlease review in the On-Call Tracker.`,
        },
      },
    ],
  });
}

export async function notifyVolunteer(engineerName: string, weekStart: string) {
  const config = await prisma.slackConfig.findFirst({
    where: { isActive: true, notifyOnRotation: true },
  });
  if (!config) return;

  await sendSlackNotification({
    text: `${engineerName} volunteered for on-call week of ${weekStart}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Volunteer* :raised_hand:\n\n*${engineerName}* has taken the on-call week of *${weekStart}*.`,
        },
      },
    ],
  });
}

export async function notifyHighSeverityCall(
  engineerName: string,
  severity: string,
  title: string
) {
  const config = await prisma.slackConfig.findFirst({
    where: { isActive: true, notifyOnHighSeverity: true },
  });
  if (!config) return;

  await sendSlackNotification({
    text: `${severity} Call: ${title} (handled by ${engineerName})`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*High Severity Call Logged* :fire:\n\n*Severity:* ${severity}\n*Title:* ${title}\n*Engineer:* ${engineerName}`,
        },
      },
    ],
  });
}
