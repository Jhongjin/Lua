import {
  ASSET_STORAGE_BUCKET,
  EDIT_CONTENT_EVENT_NAME,
} from "@/config/constants";
import { inngest } from "@/inngest/client";
import {
  createSignedVideoUploadTarget,
  recordStoredVideoAsset,
  type VideoMetadata,
} from "@/lib/assets/storage";
import { recordJobLog } from "@/lib/jobs/logs";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type ManualVideoUploadJob = Pick<
  Tables<"content_jobs">,
  "id" | "format" | "status" | "video_source" | "video_prompt"
>;

type VideoUploadMetadata = VideoMetadata & {
  sizeBytes?: number;
};

function assertVideoFile(input: { filename: string; contentType: string }) {
  const extension = input.filename.split(".").pop()?.toLowerCase();

  if (input.contentType !== "video/mp4" && extension !== "mp4") {
    throw new Error(
      `Manual reels upload only supports mp4 files, got ${input.filename} (${input.contentType}).`,
    );
  }
}

function assertVideoMetadata(metadata: VideoUploadMetadata) {
  const values = [metadata.width, metadata.height, metadata.durationSeconds];

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Video metadata must include positive width, height, and duration.");
  }
}

async function loadManualVideoUploadJob(
  jobId: string,
): Promise<ManualVideoUploadJob> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .select("id,format,status,video_source,video_prompt")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Failed to load content job ${jobId}: ${error.message}`);
  }

  if (data.format !== "reels") {
    throw new Error(
      `Manual video upload is only supported for reels jobs, got ${data.format ?? "null"}.`,
    );
  }

  if (data.video_source !== "manual") {
    throw new Error(
      `Manual video upload is only supported when video_source is manual, got ${data.video_source}.`,
    );
  }

  if (!["PLANNED", "FAILED"].includes(data.status)) {
    throw new Error(
      `Manual video upload can only start from PLANNED or FAILED, got ${data.status}.`,
    );
  }

  return data;
}

async function assertUploadedObjectExists(storagePath: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(ASSET_STORAGE_BUCKET)
    .exists(storagePath);

  if (error) {
    throw new Error(`Failed to verify uploaded video object: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Uploaded video object was not found at ${storagePath}.`);
  }
}

async function findExistingVideoAsset(input: {
  jobId: string;
  storagePath: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("job_id", input.jobId)
    .eq("storage_path", input.storagePath)
    .eq("type", "video")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing video asset: ${error.message}`);
  }

  return data;
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
    throw new Error(
      `Failed to transition manual video upload job to ASSETS_READY: ${error.message}`,
    );
  }
}

export async function createManualVideoUploadTarget(input: {
  jobId: string;
  filename: string;
  contentType: string;
  requestedBy?: string;
}) {
  assertVideoFile(input);
  await loadManualVideoUploadJob(input.jobId);

  await recordJobLog({
    jobId: input.jobId,
    step: "manual_video_upload",
    status: "started",
    message: `Creating signed upload URL for ${input.filename}${
      input.requestedBy ? ` by ${input.requestedBy}` : ""
    }.`,
  });

  return createSignedVideoUploadTarget({
    jobId: input.jobId,
    filename: input.filename,
    contentType: input.contentType,
  });
}

export async function finalizeManualVideoUpload(input: {
  jobId: string;
  storagePath: string;
  publicUrl: string;
  filename: string;
  contentType: string;
  metadata: VideoUploadMetadata;
  requestedBy?: string;
}) {
  assertVideoFile(input);
  assertVideoMetadata(input.metadata);

  const job = await loadManualVideoUploadJob(input.jobId);
  const startedAt = Date.now();

  await assertUploadedObjectExists(input.storagePath);

  const existingAsset = await findExistingVideoAsset({
    jobId: input.jobId,
    storagePath: input.storagePath,
  });
  const asset =
    existingAsset ??
    (await recordStoredVideoAsset({
      jobId: input.jobId,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl,
      promptUsed: job.video_prompt,
      validationNote: `Manual finished video upload${
        input.requestedBy ? ` by ${input.requestedBy}` : ""
      }.`,
      metadata: input.metadata,
    }));

  await transitionToAssetsReady(input.jobId);

  await recordJobLog({
    jobId: input.jobId,
    step: "manual_video_upload",
    status: "success",
    message: `Manual finished video uploaded (${input.metadata.width}x${
      input.metadata.height
    }, ${input.metadata.durationSeconds.toFixed(1)}s).`,
    durationMs: Date.now() - startedAt,
  });

  await inngest.send({
    name: EDIT_CONTENT_EVENT_NAME,
    data: {
      jobId: input.jobId,
      source: "manual_video_upload",
    },
  });

  return {
    jobId: input.jobId,
    assetId: asset.id,
    status: "ASSETS_READY",
  };
}
