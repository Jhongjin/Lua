import { PUBLISH_CONTENT_EVENT_NAME } from "@/config/constants";
import { inngest } from "@/inngest/client";
import { recordJobLog } from "@/lib/jobs/logs";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type ReviewDecision = "approve" | "reject";

type ReviewDecisionJob = Pick<Tables<"content_jobs">, "id" | "status">;

async function loadReviewDecisionJob(jobId: string): Promise<ReviewDecisionJob> {
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

function normalizeReviewNote(reviewNote?: string | null) {
  return reviewNote?.trim() ?? "";
}

async function updateReviewStatus(input: {
  jobId: string;
  status: "APPROVED" | "REJECTED";
  reviewNote?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: input.status,
      review_note: input.reviewNote ?? null,
      error_message: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(
      `Failed to transition job ${input.jobId} to ${input.status}: ${error.message}`,
    );
  }
}

export async function submitReviewDecision(input: {
  jobId: string;
  decision: ReviewDecision;
  reviewNote?: string | null;
  requestedBy?: string | null;
}) {
  const job = await loadReviewDecisionJob(input.jobId);

  if (job.status !== "PENDING_REVIEW") {
    throw new Error(
      `Review decision is only allowed for PENDING_REVIEW jobs, got ${job.status}.`,
    );
  }

  const reviewer = input.requestedBy ? ` by ${input.requestedBy}` : "";

  if (input.decision === "approve") {
    await updateReviewStatus({
      jobId: input.jobId,
      status: "APPROVED",
    });
    await recordJobLog({
      jobId: input.jobId,
      step: "review_decision",
      status: "success",
      message: `Approved${reviewer}.`,
    });
    await inngest.send({
      name: PUBLISH_CONTENT_EVENT_NAME,
      data: {
        jobId: input.jobId,
        source: "review_decision",
      },
    });

    return {
      jobId: input.jobId,
      status: "APPROVED" as const,
    };
  }

  const reviewNote = normalizeReviewNote(input.reviewNote);

  if (!reviewNote) {
    throw new Error("review_note is required when rejecting content.");
  }

  await updateReviewStatus({
    jobId: input.jobId,
    status: "REJECTED",
    reviewNote,
  });
  await recordJobLog({
    jobId: input.jobId,
    step: "review_decision",
    status: "success",
    message: `Rejected${reviewer}: ${reviewNote}`,
  });

  return {
    jobId: input.jobId,
    status: "REJECTED" as const,
    reviewNote,
  };
}
