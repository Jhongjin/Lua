import {
  EDIT_CONTENT_EVENT_NAME,
  GENERATE_ASSETS_EVENT_NAME,
  type ImageSource,
} from "@/config/constants";
import { inngest } from "@/inngest/client";
import {
  acquireImageAssets,
  type ImageAssetAcquisitionResult,
} from "@/lib/assets/image";
import { recordJobLog, markContentJobFailed } from "@/lib/jobs/logs";
import { sendReviewNotification } from "@/lib/notify/slack";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  markAssetValidation,
  validateImageAssets,
  type AssetValidationResult,
} from "@/lib/validation/asset-gate";
import type { Tables } from "@/types/database";

type GenerateAssetsEventData = {
  jobId?: string;
  source?: "plan_content" | "dashboard" | "cron" | "api";
};

type AssetJob = Pick<
  Tables<"content_jobs">,
  "id" | "persona_id" | "status" | "format" | "image_prompt" | "image_source"
>;

type AssetPersona = Pick<
  Tables<"personas">,
  "id" | "name" | "reference_image_urls" | "visual_guide"
>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function loadAssetContext(jobId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: job, error: jobError } = await supabase
    .from("content_jobs")
    .select("id,persona_id,status,format,image_prompt,image_source")
    .eq("id", jobId)
    .single();

  if (jobError) {
    throw new Error(`Failed to load content job ${jobId}: ${jobError.message}`);
  }

  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("id,name,reference_image_urls,visual_guide")
    .eq("id", job.persona_id)
    .single();

  if (personaError) {
    throw new Error(
      `Failed to load persona ${job.persona_id}: ${personaError.message}`,
    );
  }

  return {
    job: job as AssetJob,
    persona: persona as AssetPersona,
  };
}

async function setManualUploadPending(jobId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      review_note: "수동 업로드 대기",
      error_message: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to mark manual upload pending: ${error.message}`);
  }
}

async function transitionToAssetsGenerating(jobId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: "ASSETS_GENERATING",
      error_message: null,
      review_note: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to transition job to ASSETS_GENERATING: ${error.message}`);
  }
}

async function transitionToAssetsReady(jobId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: "ASSETS_READY",
      error_message: null,
      review_note: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to transition job to ASSETS_READY: ${error.message}`);
  }
}

function sourceForRegeneration(input: {
  configuredSource: Exclude<ImageSource, "manual">;
  result: ImageAssetAcquisitionResult;
}) {
  if (input.configuredSource === "auto" && input.result.sourceUsed === "hedra") {
    return "fal" as const;
  }

  if (input.configuredSource === "auto") {
    return "auto" as const;
  }

  return input.configuredSource;
}

async function validateGeneratedAssets(input: {
  job: AssetJob;
  result: ImageAssetAcquisitionResult;
}): Promise<AssetValidationResult> {
  const validation = validateImageAssets({
    job: input.job,
    assets: input.result.assets,
  });
  await markAssetValidation({
    assetIds: input.result.assets.map((asset) => asset.id),
    result: validation,
  });

  return validation;
}

export const generateAssets = inngest.createFunction(
  {
    id: "lua-generate-assets",
    retries: 3,
    triggers: [{ event: GENERATE_ASSETS_EVENT_NAME }],
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as GenerateAssetsEventData;

    if (!data.jobId) {
      throw new Error("Missing jobId for asset generation.");
    }

    const { job, persona } = await step.run("load-asset-context", () =>
      loadAssetContext(data.jobId as string),
    );

    if (job.status !== "PLANNED") {
      await step.run("log-skipped-non-planned-job", () =>
        recordJobLog({
          jobId: job.id,
          step: "generate_assets",
          status: "success",
          message: `Skipped asset generation because job status is ${job.status}.`,
        }),
      );

      return {
        jobId: job.id,
        status: job.status,
        skipped: true,
      };
    }

    if (job.format === "reels") {
      await step.run("log-reels-stub", () =>
        recordJobLog({
          jobId: job.id,
          step: "generate_assets",
          status: "success",
          message: "Reels/video asset path is intentionally stubbed in 3-A.",
        }),
      );

      return {
        jobId: job.id,
        status: job.status,
        skipped: true,
        reason: "reels_stub",
      };
    }

    const configuredSource = job.image_source;

    if (configuredSource === "manual") {
      await step.run("mark-manual-upload-pending", async () => {
        await setManualUploadPending(job.id);
        await recordJobLog({
          jobId: job.id,
          step: "manual_upload_wait",
          status: "success",
          message: "Manual image upload is required before assets can continue.",
        });
      });

      return {
        jobId: job.id,
        status: "PLANNED",
        manualUploadPending: true,
      };
    }

    try {
      await step.run("transition-assets-generating", async () => {
        await transitionToAssetsGenerating(job.id);
        await recordJobLog({
          jobId: job.id,
          step: "generate_assets",
          status: "started",
          message: `Generating image asset(s) with source ${configuredSource}.`,
        });
      });

      const firstResult = await step.run("generate-image-assets", () =>
        acquireImageAssets({
          job,
          persona,
          source: configuredSource,
          onFallback: async (reason) => {
            await recordJobLog({
              jobId: job.id,
              step: "generate_assets_fallback",
              status: "retry",
              message: `Hedra failed; falling back to fal: ${reason}`,
            });
          },
        }),
      );

      let finalResult = firstResult;
      let validation = await step.run("validate-image-assets", async () => {
        const result = await validateGeneratedAssets({
          job,
          result: firstResult,
        });
        await recordJobLog({
          jobId: job.id,
          step: "asset_gate",
          status: result.ok ? "success" : "failed",
          message: result.ok
            ? "Generated image assets passed validation."
            : result.reasons.join(" | "),
          costCredits: firstResult.costCredits,
        });
        return result;
      });

      if (!validation.ok) {
        const regenerationSource = sourceForRegeneration({
          configuredSource,
          result: firstResult,
        });
        finalResult = await step.run("regenerate-image-assets-after-gate", async () => {
          await recordJobLog({
            jobId: job.id,
            step: "asset_gate_regenerate",
            status: "retry",
            message: `Regenerating image assets with source ${regenerationSource} after validation failure: ${validation.reasons.join(
              " | ",
            )}`,
          });
          return acquireImageAssets({
            job,
            persona,
            source: regenerationSource,
            onFallback: async (reason) => {
              await recordJobLog({
                jobId: job.id,
                step: "generate_assets_fallback",
                status: "retry",
                message: `Hedra failed during regeneration; falling back to fal: ${reason}`,
              });
            },
          });
        });

        validation = await step.run("validate-regenerated-image-assets", async () => {
          const result = await validateGeneratedAssets({
            job,
            result: finalResult,
          });
          await recordJobLog({
            jobId: job.id,
            step: "asset_gate_regenerated",
            status: result.ok ? "success" : "failed",
            message: result.ok
              ? "Regenerated image assets passed validation."
              : result.reasons.join(" | "),
            costCredits: finalResult.costCredits,
          });
          return result;
        });
      }

      if (!validation.ok) {
        const message = `Image asset generation failed validation: ${validation.reasons.join(
          " | ",
        )}`;
        await step.run("mark-assets-failed", () =>
          markContentJobFailed(job.id, message),
        );
        await step.run("notify-assets-failed", () =>
          sendReviewNotification({
            title: "LUA image asset generation failed",
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

      await step.run("transition-assets-ready", async () => {
        await transitionToAssetsReady(job.id);
        await recordJobLog({
          jobId: job.id,
          step: "generate_assets",
          status: "success",
          message: `Image assets ready from ${finalResult.sourceUsed}.`,
          costCredits: finalResult.costCredits,
        });
      });

      await step.run("enqueue-edit-content", () =>
        inngest.send({
          name: EDIT_CONTENT_EVENT_NAME,
          data: {
            jobId: job.id,
            source: "generate_assets",
          },
        }),
      );

      return {
        jobId: job.id,
        status: "ASSETS_READY",
        sourceUsed: finalResult.sourceUsed,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      await step.run("mark-generation-error-failed", async () => {
        await markContentJobFailed(job.id, message);
        await recordJobLog({
          jobId: job.id,
          step: "generate_assets",
          status: "failed",
          message,
        });
      });
      await step.run("notify-generation-error", () =>
        sendReviewNotification({
          title: "LUA image asset generation error",
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
