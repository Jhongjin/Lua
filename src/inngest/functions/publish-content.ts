import { PUBLISH_CONTENT_EVENT_NAME } from "@/config/constants";
import { inngest } from "@/inngest/client";
import { recordJobLog } from "@/lib/jobs/logs";

type PublishContentEventData = {
  jobId?: string;
  source?: "review_decision" | "api";
};

export const publishContent = inngest.createFunction(
  {
    id: "lua-publish-content",
    retries: 0,
    triggers: [{ event: PUBLISH_CONTENT_EVENT_NAME }],
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as PublishContentEventData;

    if (!data.jobId) {
      throw new Error("Missing jobId for publish stub.");
    }

    await step.run("log-publish-stub", () =>
      recordJobLog({
        jobId: data.jobId as string,
        step: "publish_content",
        status: "success",
        message:
          "Publishing is intentionally stubbed in 4-A. Job remains APPROVED until 4-B.",
      }),
    );

    return {
      jobId: data.jobId,
      status: "APPROVED",
      skipped: true,
      reason: "publish_stub",
    };
  },
);
