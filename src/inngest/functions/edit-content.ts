import { EDIT_CONTENT_EVENT_NAME } from "@/config/constants";
import { inngest } from "@/inngest/client";
import { prepareFinalImageUrls } from "@/lib/editing/image";
import { markContentJobFailed, recordJobLog } from "@/lib/jobs/logs";
import { sendReviewNotification } from "@/lib/notify/slack";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type EditContentEventData = {
  jobId?: string;
  source?: "generate_assets" | "manual_upload" | "api";
};

type EditJob = Pick<Tables<"content_jobs">, "id" | "status" | "format">;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function loadEditJob(jobId: string): Promise<EditJob> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .select("id,status,format")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Failed to load content job ${jobId}: ${error.message}`);
  }

  return data;
}

async function updateEditingStatus(input: {
  jobId: string;
  status: "EDITING" | "EDITED";
  finalImageUrls?: string[];
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: input.status,
      final_image_urls: input.finalImageUrls,
      error_message: null,
      review_note: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to transition job to ${input.status}: ${error.message}`);
  }
}

export const editContent = inngest.createFunction(
  {
    id: "lua-edit-content",
    retries: 3,
    triggers: [{ event: EDIT_CONTENT_EVENT_NAME }],
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as EditContentEventData;

    if (!data.jobId) {
      throw new Error("Missing jobId for content editing.");
    }

    const job = await step.run("load-edit-job", () => loadEditJob(data.jobId as string));

    if (job.status !== "ASSETS_READY") {
      await step.run("log-skipped-non-ready-job", () =>
        recordJobLog({
          jobId: job.id,
          step: "edit_content",
          status: "success",
          message: `Skipped editing because job status is ${job.status}.`,
        }),
      );

      return {
        jobId: job.id,
        status: job.status,
        skipped: true,
      };
    }

    if (job.format === "reels") {
      await step.run("log-video-edit-stub", () =>
        recordJobLog({
          jobId: job.id,
          step: "edit_content",
          status: "success",
          message: "Reels/video editing is intentionally stubbed in 3-A.",
        }),
      );

      return {
        jobId: job.id,
        status: job.status,
        skipped: true,
        reason: "reels_stub",
      };
    }

    try {
      await step.run("transition-editing", async () => {
        await updateEditingStatus({
          jobId: job.id,
          status: "EDITING",
        });
        await recordJobLog({
          jobId: job.id,
          step: "edit_content",
          status: "started",
          message: "Preparing final image URLs.",
        });
      });

      const finalImageUrls = await step.run("prepare-final-image-urls", () =>
        prepareFinalImageUrls(job.id),
      );

      await step.run("transition-edited", async () => {
        await updateEditingStatus({
          jobId: job.id,
          status: "EDITED",
          finalImageUrls,
        });
        await recordJobLog({
          jobId: job.id,
          step: "edit_content",
          status: "success",
          message: `Image content edited with ${finalImageUrls.length} final URL(s).`,
        });
      });

      return {
        jobId: job.id,
        status: "EDITED",
        finalImageUrls,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      await step.run("mark-edit-failed", async () => {
        await markContentJobFailed(job.id, message);
        await recordJobLog({
          jobId: job.id,
          step: "edit_content",
          status: "failed",
          message,
        });
      });
      await step.run("notify-edit-failed", () =>
        sendReviewNotification({
          title: "LUA image editing error",
          message,
          jobId: job.id,
        }),
      );

      return {
        jobId: job.id,
        status: "FAILED",
        reason: message,
      };
    }
  },
);
