import type { VideoSource } from "@/config/constants";
import type { Tables } from "@/types/database";

type VideoGenerationSource = Exclude<VideoSource, "manual">;

type VideoGenerationJob = Pick<
  Tables<"content_jobs">,
  "id" | "format" | "video_prompt" | "video_source"
>;

type VideoGenerationPersona = Pick<
  Tables<"personas">,
  "id" | "name" | "reference_image_urls" | "visual_guide"
>;

export type VideoGenerationRequest = {
  job: VideoGenerationJob;
  persona: VideoGenerationPersona;
  source: VideoGenerationSource;
};

export type VideoGenerationResult = {
  provider: VideoGenerationSource;
  providerJobId: string;
  assetUrl: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  costCredits?: number;
};

export async function requestVideoAssetGeneration(
  input: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  // 3-B intentionally does not implement unattended video generation.
  //
  // Future Veo/auto flow:
  // 1. Submit input.job.video_prompt plus persona reference images to Veo.
  // 2. Persist providerJobId in job_logs or a provider_runs table.
  // 3. Poll provider status or resume from a webhook callback.
  // 4. Download the finished vertical reels asset into Supabase Storage.
  // 5. Insert an assets row with width, height, duration_seconds, and cost.
  // 6. Let asset-gate validate the video before the edit-content step.
  throw new Error(
    `Video generation source ${input.source} is not implemented in phase 3-B. Use video_source=manual and upload a finished mp4.`,
  );
}
