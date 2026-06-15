import { EDIT_CONTENT_EVENT_NAME } from "@/config/constants";
import { inngest } from "@/inngest/client";
import { storeImageAsset } from "@/lib/assets/storage";
import { recordJobLog } from "@/lib/jobs/logs";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  markAssetValidation,
  validateImageAssets,
} from "@/lib/validation/asset-gate";
import type { Tables } from "@/types/database";

type ManualUploadJob = Pick<
  Tables<"content_jobs">,
  "id" | "format" | "image_prompt" | "image_source" | "status"
>;

function assertImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`Unsupported file type for ${file.name}: ${file.type}`);
  }
}

async function loadManualUploadJob(jobId: string): Promise<ManualUploadJob> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .select("id,format,image_prompt,image_source,status")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Failed to load content job ${jobId}: ${error.message}`);
  }

  if (!["image", "carousel"].includes(data.format ?? "")) {
    throw new Error(
      `Manual image upload is only supported for image/carousel jobs, got ${data.format ?? "null"}.`,
    );
  }

  return data;
}

export async function uploadManualImageAssets(input: {
  jobId: string;
  files: File[];
  requestedBy?: string;
}) {
  if (input.files.length === 0) {
    throw new Error("At least one image file is required.");
  }

  const job = await loadManualUploadJob(input.jobId);
  const startedAt = Date.now();

  await recordJobLog({
    jobId: input.jobId,
    step: "manual_upload",
    status: "started",
    message: `Uploading ${input.files.length} manual image asset(s).`,
  });

  const storedAssets: Tables<"assets">[] = [];

  for (const file of input.files) {
    assertImageFile(file);
    const asset = await storeImageAsset({
      jobId: input.jobId,
      bytes: await file.arrayBuffer(),
      contentType: file.type,
      filename: file.name,
      promptUsed: job.image_prompt,
      validationNote: `Manual upload${input.requestedBy ? ` by ${input.requestedBy}` : ""}.`,
    });

    storedAssets.push(asset);
  }

  const validation = validateImageAssets({
    job,
    assets: storedAssets,
  });
  await markAssetValidation({
    assetIds: storedAssets.map((asset) => asset.id),
    result: validation,
  });

  if (!validation.ok) {
    await recordJobLog({
      jobId: input.jobId,
      step: "manual_upload",
      status: "failed",
      message: validation.reasons.join(" | "),
      durationMs: Date.now() - startedAt,
    });
    throw new Error(`Manual upload failed asset gate: ${validation.reasons.join(" | ")}`);
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: "ASSETS_READY",
      error_message: null,
      review_note: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(
      `Failed to transition manual upload job to ASSETS_READY: ${error.message}`,
    );
  }

  await recordJobLog({
    jobId: input.jobId,
    step: "manual_upload",
    status: "success",
    message: "Manual image assets uploaded and passed validation.",
    durationMs: Date.now() - startedAt,
  });

  await inngest.send({
    name: EDIT_CONTENT_EVENT_NAME,
    data: {
      jobId: input.jobId,
      source: "manual_upload",
    },
  });

  return {
    jobId: input.jobId,
    assetIds: storedAssets.map((asset) => asset.id),
    status: "ASSETS_READY",
  };
}
