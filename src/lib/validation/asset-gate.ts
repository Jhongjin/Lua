import {
  MAX_REELS_DURATION_SECONDS,
  MIN_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
  REELS_ASPECT_RATIO_TOLERANCE,
  REQUIRED_CAROUSEL_IMAGE_COUNT,
  TARGET_REELS_ASPECT_RATIO,
} from "@/config/constants";
import type { Tables } from "@/types/database";

type ImageJob = Pick<Tables<"content_jobs">, "id" | "format">;
type VideoJob = Pick<Tables<"content_jobs">, "id" | "format">;

export type AssetValidationResult = {
  ok: boolean;
  reasons: string[];
};

export type FaceSimilarityCheckInput = {
  assetUrl: string;
  referenceImageUrls: string[];
};

export type FaceSimilarityCheck = (
  input: FaceSimilarityCheckInput,
) => Promise<number | null>;

export const faceSimilarityCheckStub: FaceSimilarityCheck = async () => {
  // 3-A keeps face similarity optional. A later stage can replace this with
  // an embedding/model-backed checker while keeping the validation contract.
  return null;
};

function requiredImageCount(format: ImageJob["format"]) {
  if (format === "carousel") {
    return REQUIRED_CAROUSEL_IMAGE_COUNT;
  }

  return 1;
}

export function validateImageAssets(input: {
  job: ImageJob;
  assets: Pick<
    Tables<"assets">,
    "id" | "type" | "public_url" | "width" | "height"
  >[];
  minWidth?: number;
  minHeight?: number;
}): AssetValidationResult {
  const reasons: string[] = [];
  const minWidth = input.minWidth ?? MIN_IMAGE_WIDTH;
  const minHeight = input.minHeight ?? MIN_IMAGE_HEIGHT;
  const imageAssets = input.assets.filter((asset) => asset.type === "image");
  const requiredCount = requiredImageCount(input.job.format);

  if (!["image", "carousel"].includes(input.job.format ?? "")) {
    return {
      ok: false,
      reasons: [`Unsupported image asset format: ${input.job.format ?? "null"}`],
    };
  }

  if (imageAssets.length < requiredCount) {
    reasons.push(
      `Expected at least ${requiredCount} image asset(s), got ${imageAssets.length}.`,
    );
  }

  for (const asset of imageAssets) {
    if (!asset.public_url) {
      reasons.push(`Asset ${asset.id} has no public_url.`);
    }

    if (!asset.width || !asset.height) {
      reasons.push(`Asset ${asset.id} is missing dimensions.`);
      continue;
    }

    if (asset.width < minWidth || asset.height < minHeight) {
      reasons.push(
        `Asset ${asset.id} is too small (${asset.width}x${asset.height}); minimum is ${minWidth}x${minHeight}.`,
      );
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function validateVideoAssets(input: {
  job: VideoJob;
  assets: Pick<
    Tables<"assets">,
    "id" | "type" | "public_url" | "width" | "height" | "duration_seconds"
  >[];
  maxDurationSeconds?: number;
  aspectRatio?: number;
  aspectRatioTolerance?: number;
}): AssetValidationResult {
  const reasons: string[] = [];
  const videoAssets = input.assets.filter((asset) => asset.type === "video");
  const maxDurationSeconds =
    input.maxDurationSeconds ?? MAX_REELS_DURATION_SECONDS;
  const aspectRatio = input.aspectRatio ?? TARGET_REELS_ASPECT_RATIO;
  const aspectRatioTolerance =
    input.aspectRatioTolerance ?? REELS_ASPECT_RATIO_TOLERANCE;

  if (input.job.format !== "reels") {
    return {
      ok: false,
      reasons: [`Unsupported video asset format: ${input.job.format ?? "null"}`],
    };
  }

  if (videoAssets.length < 1) {
    reasons.push("Expected at least one video asset.");
  }

  for (const asset of videoAssets) {
    if (!asset.public_url) {
      reasons.push(`Asset ${asset.id} has no public_url.`);
    }

    if (!asset.width || !asset.height) {
      reasons.push(`Asset ${asset.id} is missing video dimensions.`);
    } else {
      const actualAspectRatio = asset.width / asset.height;
      const diff = Math.abs(actualAspectRatio - aspectRatio);

      if (diff > aspectRatioTolerance) {
        reasons.push(
          `Asset ${asset.id} is not 9:16 vertical video (${asset.width}x${asset.height}).`,
        );
      }
    }

    const durationSeconds =
      typeof asset.duration_seconds === "number"
        ? asset.duration_seconds
        : asset.duration_seconds === null
          ? null
          : Number(asset.duration_seconds);

    if (!durationSeconds || Number.isNaN(durationSeconds)) {
      reasons.push(`Asset ${asset.id} is missing duration_seconds.`);
    } else if (durationSeconds > maxDurationSeconds) {
      reasons.push(
        `Asset ${asset.id} is too long (${durationSeconds.toFixed(
          1,
        )}s); maximum is ${maxDurationSeconds}s.`,
      );
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export async function markAssetValidation(input: {
  assetIds: string[];
  result: AssetValidationResult;
  successNote?: string;
}) {
  if (input.assetIds.length === 0) {
    return;
  }

  const { getSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("assets")
    .update({
      validation_passed: input.result.ok,
      validation_note: input.result.ok
        ? (input.successNote ?? "Image asset gate passed.")
        : input.result.reasons.join(" | "),
    })
    .in("id", input.assetIds);

  if (error) {
    throw new Error(`Failed to update asset validation: ${error.message}`);
  }
}
