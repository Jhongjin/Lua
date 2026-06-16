import { REQUEST_REVIEW_EVENT_NAME } from "@/config/constants";
import { inngest } from "@/inngest/client";
import { recordJobLog } from "@/lib/jobs/logs";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type RequestReviewEventData = {
  jobId?: string;
  source?: "edit_content" | "api";
};

type ReviewRequestJob = Pick<Tables<"content_jobs">, "id" | "status">;

async function loadReviewRequestJob(jobId: string): Promise<ReviewRequestJob> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .select("id,status")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Failed to load content job ${jobId}: ${error.message}`);
  }

  return data;
}

async function transitionToPendingReview(jobId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: "PENDING_REVIEW",
      error_message: null,
      review_note: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to transition job to PENDING_REVIEW: ${error.message}`);
  }
}

export const requestReview = inngest.createFunction(
  {
    id: "lua-request-review",
    retries: 3,
    triggers: [{ event: REQUEST_REVIEW_EVENT_NAME }],
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as RequestReviewEventData;

    if (!data.jobId) {
      throw new Error("Missing jobId for review request.");
    }

    const job = await step.run("load-review-request-job", () =>
      loadReviewRequestJob(data.jobId as string),
    );

    if (job.status !== "EDITED") {
      await step.run("log-skipped-non-edited-job", () =>
        recordJobLog({
          jobId: job.id,
          step: "request_review",
          status: "success",
          message: `Skipped review request because job status is ${job.status}.`,
        }),
      );

      return {
        jobId: job.id,
        status: job.status,
        skipped: true,
      };
    }

    await step.run("transition-pending-review", async () => {
      await transitionToPendingReview(job.id);
      await recordJobLog({
        jobId: job.id,
        step: "request_review",
        status: "success",
        message: "Content is ready for dashboard review.",
      });
      // Slack notification remains intentionally stubbed for 4-A.
    });

    return {
      jobId: job.id,
      status: "PENDING_REVIEW",
    };
  },
);
