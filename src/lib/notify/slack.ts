export type SlackNotificationPayload = {
  title: string;
  message: string;
  jobId?: string;
};

export async function sendReviewNotification(
  payload: SlackNotificationPayload,
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL is not set; skipping Slack notification.", {
      jobId: payload.jobId,
      title: payload.title,
    });
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: `*${payload.title}*\n${payload.message}${
        payload.jobId ? `\nJob: ${payload.jobId}` : ""
      }`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Slack notification failed: ${response.status} ${await response.text()}`,
    );
  }
}
