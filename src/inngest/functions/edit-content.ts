import { EDIT_CONTENT_EVENT_NAME } from "@/config/constants";
import { inngest } from "@/inngest/client";
import { prepareFinalImageUrls } from "@/lib/editing/image";
import { markContentJobFailed, recordJobLog } from "@/lib/jobs/logs";
import { sendReviewNotification } from "@/lib/notify/slack";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  markAssetValidation,
  validateVideoAssets,
} from "@/lib/validation/asset-gate";
import type { Tables } from "@/types/database";

type EditContentEventData = {
  jobId?: string;
  source?: "generate_assets" | "manual_upload" | "manual_video_upload" | "api";
};

type EditJob = Pick<
  Tables<"content_jobs">,
  "id" | "status" | "format" | "video_source"
>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function loadEditJob(jobId: string): Promise<EditJob> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .select("id,status,format,video_source")
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
  finalVideoUrl?: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: input.status,
      final_image_urls: input.finalImageUrls,
      final_video_url: input.finalVideoUrl,
      error_message: null,
      review_note: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to transition job to ${input.status}: ${error.message}`);
  }
}

async function prepareFinalVideoUrl(job: EditJob) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id,type,public_url,width,height,duration_seconds,created_at")
    .eq("job_id", job.id)
    .eq("type", "video")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load video assets for ${job.id}: ${error.message}`);
  }

  const validation = validateVideoAssets({
    job,
    assets: assets ?? [],
  });

  await markAssetValidation({
    assetIds: (assets ?? []).map((asset) => asset.id),
    result: validation,
    successNote: "Video asset gate passed.",
  });

  if (!validation.ok) {
    throw new Error(`Video asset gate failed: ${validation.reasons.join(" | ")}`);
  }

  const asset = assets?.[0];

  if (!asset?.public_url) {
    throw new Error("Validated video asset is missing public_url.");
  }

  return asset.public_url;
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
          message:
            job.format === "reels"
              ? "Validating uploaded finished video and preparing final URL."
              : "Preparing final image URLs.",
        });
      });

      if (job.format === "reels") {
        if (job.video_source !== "manual") {
          throw new Error(
            `Automatic video editing is not implemented in phase 3-B for video_source=${job.video_source}.`,
          );
        }

        const finalVideoUrl = await step.run("prepare-final-video-url", () =>
          prepareFinalVideoUrl(job),
        );

        await step.run("transition-video-edited", async () => {
          await updateEditingStatus({
            jobId: job.id,
            status: "EDITED",
            finalVideoUrl,
          });
          await recordJobLog({
            jobId: job.id,
            step: "edit_content",
            status: "success",
            message: "Manual uploaded reels video accepted as final edit.",
          });
        });

        return {
          jobId: job.id,
          status: "EDITED",
          finalVideoUrl,
        };
      }

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
          title:
            job.format === "reels"
              ? "LUA video editing error"
              : "LUA image editing error",
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
