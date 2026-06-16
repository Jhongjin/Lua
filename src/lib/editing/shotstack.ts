export type ShotstackRenderInput = {
  jobId: string;
  sourceVideoUrl: string;
  captionsOnScreen?: string[] | null;
  backgroundMusicUrl?: string | null;
  outputAspectRatio?: "9:16";
};

export type ShotstackRenderResult = {
  providerRenderId: string;
  finalVideoUrl: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  costCredits?: number;
};

export async function renderEditedVideoWithShotstack(
  input: ShotstackRenderInput,
): Promise<ShotstackRenderResult> {
  // 3-B intentionally skips automatic video post-processing.
  //
  // Future Shotstack flow:
  // 1. Build a render timeline from input.sourceVideoUrl.
  // 2. Overlay captions_on_screen and add BGM if configured.
  // 3. Submit the render and persist providerRenderId.
  // 4. Poll render status or resume from a webhook callback.
  // 5. Download the final 9:16 mp4 into Supabase Storage.
  // 6. Return finalVideoUrl for content_jobs.final_video_url.
  throw new Error(
    `Shotstack video post-processing is not implemented in phase 3-B for job ${input.jobId}. Manual uploaded reels are treated as final edits.`,
  );
}
