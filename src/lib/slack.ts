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

export async function notifySwapPost(
  posterName: string,
  weekStart: string,
  postType: "GIVE_AWAY" | "SWAP",
  coverageType: "FULL_WEEK" | "SPECIFIC_DAYS",
  daysDescription?: string
) {
  const config = await prisma.slackConfig.findFirst({
    where: { isActive: true, notifyOnSwap: true },
  });
  if (!config) return;

  const action = postType === "GIVE_AWAY" ? "is giving away" : "wants to swap";
  const coverage =
    coverageType === "FULL_WEEK"
      ? `the week of *${weekStart}*`
      : `${daysDescription} (week of ${weekStart})`;

  await sendSlackNotification({
    text: `Swap Board: ${posterName} ${action} ${coverage}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Swap Board Post* :clipboard:\n\n*${posterName}* ${action} ${coverage}.\n\nView the swap board to claim it.`,
        },
      },
    ],
  });
}

export async function notifySwapClaimed(
  claimerName: string,
  posterName: string,
  weekStart: string,
  postType: "GIVE_AWAY" | "SWAP"
) {
  const config = await prisma.slackConfig.findFirst({
    where: { isActive: true, notifyOnSwap: true },
  });
  if (!config) return;

  const verb = postType === "GIVE_AWAY" ? "took" : "swapped";

  await sendSlackNotification({
    text: `Swap Board: ${claimerName} ${verb} ${posterName}'s week of ${weekStart}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Swap Claimed* :handshake:\n\n*${claimerName}* ${verb} *${posterName}*'s week of *${weekStart}*.`,
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

export async function notifyCompensationRulesUpdated(adminName: string) {
  const config = await prisma.slackConfig.findFirst({
    where: { isActive: true },
  });
  if (!config) return;

  await sendSlackNotification({
    text: `Compensation Rules Updated by ${adminName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Compensation Rules Updated* :pencil:\n\n*${adminName}* updated the compensation rules. Check the guide for the latest rates.`,
        },
      },
    ],
  });
}
