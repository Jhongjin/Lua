import {
  MIN_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
  REQUIRED_CAROUSEL_IMAGE_COUNT,
} from "@/config/constants";
import type { Tables } from "@/types/database";

type ImageJob = Pick<Tables<"content_jobs">, "id" | "format">;

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

export async function markAssetValidation(input: {
  assetIds: string[];
  result: AssetValidationResult;
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
        ? "Image asset gate passed."
        : input.result.reasons.join(" | "),
    })
    .in("id", input.assetIds);

  if (error) {
    throw new Error(`Failed to update asset validation: ${error.message}`);
  }
}
