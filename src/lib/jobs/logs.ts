import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/config/constants";

export type JobLogStatus = "started" | "success" | "failed" | "retry";

export async function recordJobLog(input: {
  jobId: string;
  step: string;
  status: JobLogStatus;
  message?: string;
  durationMs?: number;
  costCredits?: number;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("job_logs").insert({
    job_id: input.jobId,
    step: input.step,
    status: input.status,
    message: input.message,
    duration_ms: input.durationMs,
    cost_credits: input.costCredits,
  });

  if (error) {
    throw new Error(`Failed to write job log: ${error.message}`);
  }
}

export async function updateContentJobStatus(input: {
  jobId: string;
  status: JobStatus;
  message?: string | null;
  reviewNote?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: input.status,
      error_message: input.message ?? null,
      review_note: input.reviewNote ?? null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(
      `Failed to update content job ${input.jobId} to ${input.status}: ${error.message}`,
    );
  }
}

export async function markContentJobFailed(jobId: string, message: string) {
  await updateContentJobStatus({
    jobId,
    status: "FAILED",
    message,
  });
}
