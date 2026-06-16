import { fal } from "@fal-ai/client";
import {
  REQUIRED_CAROUSEL_IMAGE_COUNT,
  type ImageSource,
} from "@/config/constants";
import {
  downloadImageBytes,
  storeImageAsset,
} from "@/lib/assets/storage";
import type { Tables } from "@/types/database";

type ImageJob = Pick<
  Tables<"content_jobs">,
  "id" | "format" | "image_prompt" | "image_source"
>;

type ImagePersona = Pick<
  Tables<"personas">,
  "id" | "name" | "reference_image_urls" | "visual_guide"
>;

type AutomatedImageSource = Exclude<ImageSource, "manual" | "auto">;

export type ImageAssetAcquisitionResult = {
  assets: Tables<"assets">[];
  sourceUsed: AutomatedImageSource;
  fallbackReason?: string;
  costCredits: number;
};

type GenerateInput = {
  job: ImageJob;
  persona: ImagePersona;
  source: Exclude<ImageSource, "manual">;
  onFallback?: (reason: string) => Promise<void> | void;
};

const HEDRA_BASE_URL = "https://api.hedra.com/web-app/public";
const DEFAULT_HEDRA_TIMEOUT_MS = 180_000;
const DEFAULT_FAL_TIMEOUT_MS = 180_000;
const DEFAULT_HEDRA_TEXT_TO_IMAGE_MODEL_ID =
  "a66300b4-f76e-4c4a-ac41-b31694ff585e";
const DEFAULT_HEDRA_RESOLUTION = "1080p";
const DEFAULT_HEDRA_ASPECT_RATIO = "9:16";
const DEFAULT_FAL_TEXT_MODEL = "fal-ai/flux/schnell";
const DEFAULT_FAL_REFERENCE_MODEL = "fal-ai/vidu/q2/reference-to-image";

let cachedHedraModelId: string | null = null;

type HedraModel = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  type?: unknown;
  aspect_ratios?: unknown;
  resolutions?: unknown;
  requires_start_frame?: unknown;
  requires_end_frame?: unknown;
  requires_input_video?: unknown;
};

function requiredImageCount(format: ImageJob["format"]) {
  if (format === "carousel") {
    return REQUIRED_CAROUSEL_IMAGE_COUNT;
  }

  return 1;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing server environment variable: ${name}`);
  }

  return value;
}

function buildPrompt(job: ImageJob, persona: ImagePersona) {
  if (!job.image_prompt) {
    throw new Error(`Content job ${job.id} is missing image_prompt.`);
  }

  const referenceImageUrls = persona.reference_image_urls ?? [];
  const referenceInstruction =
    referenceImageUrls.length > 0
      ? ` Maintain identity consistency with these reference image URLs: ${referenceImageUrls.join(", ")}.`
      : "";
  const visualGuide = persona.visual_guide ? ` Visual guide: ${persona.visual_guide}.` : "";

  return `${job.image_prompt}.${visualGuide}${referenceInstruction}`;
}

function findFirstUrl(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);

      if (found) {
        return found;
      }
    }
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      const found = findFirstUrl(nestedValue);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function getGenerationId(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record.id ?? record.generation_id ?? record.job_id;

  return typeof id === "string" ? id : null;
}

function getAssetId(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record.asset_id ?? record.assetId;

  return typeof id === "string" ? id : null;
}

function getObjectUrl(record: Record<string, unknown>) {
  const asset = record.asset;
  const nestedAssetUrl =
    asset && typeof asset === "object"
      ? ((asset as Record<string, unknown>).url ??
        (asset as Record<string, unknown>).download_url)
      : null;
  const url =
    nestedAssetUrl ??
    record.url ??
    record.download_url ??
    record.streaming_url ??
    record.thumbnail_url;

  return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
}

function findPreferredUrl(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPreferredUrl(item);

      if (found) {
        return found;
      }
    }
  }

  if (value && typeof value === "object") {
    const recordUrl = getObjectUrl(value as Record<string, unknown>);

    if (recordUrl) {
      return recordUrl;
    }

    for (const nestedValue of Object.values(value)) {
      const found = findPreferredUrl(nestedValue);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function supportsValue(values: string[], expected: string) {
  if (values.length === 0) {
    return true;
  }

  return values.some((value) => value.toLowerCase() === expected.toLowerCase());
}

function getHedraModelText(model: HedraModel) {
  return `${model.name ?? ""} ${model.description ?? ""}`.toLowerCase();
}

function isHedraImageModel(model: unknown): model is HedraModel {
  if (!model || typeof model !== "object") {
    return false;
  }

  const record = model as HedraModel;
  return String(record.type ?? "").toLowerCase().includes("image");
}

function isLikelyTextToImageHedraModel(model: HedraModel) {
  const text = getHedraModelText(model);

  return (
    !model.requires_start_frame &&
    !model.requires_end_frame &&
    !model.requires_input_video &&
    !/\b(i2i|image-to-image|editing|edit)\b/.test(text)
  );
}

function scoreHedraImageModel(model: HedraModel) {
  const text = getHedraModelText(model);
  const resolutions = asStringArray(model.resolutions);
  const aspectRatios = asStringArray(model.aspect_ratios);
  let score = 0;

  if (model.id === DEFAULT_HEDRA_TEXT_TO_IMAGE_MODEL_ID) {
    score += 100;
  }

  if (/\b(t2i|text-to-image)\b/.test(text)) {
    score += 50;
  }

  if (supportsValue(resolutions, DEFAULT_HEDRA_RESOLUTION)) {
    score += 20;
  }

  if (supportsValue(aspectRatios, DEFAULT_HEDRA_ASPECT_RATIO)) {
    score += 10;
  }

  if (!isLikelyTextToImageHedraModel(model)) {
    score -= 100;
  }

  return score;
}

async function hedraFetchJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 45_000,
): Promise<T> {
  const apiKey = requireEnv("HEDRA_API_KEY");
  const response = await fetch(`${HEDRA_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...init.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Hedra API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function getHedraImageModelId() {
  if (process.env.HEDRA_IMAGE_MODEL_ID) {
    return process.env.HEDRA_IMAGE_MODEL_ID;
  }

  if (cachedHedraModelId) {
    return cachedHedraModelId;
  }

  const modelResponse = await hedraFetchJson<unknown>("/models");
  const models = Array.isArray(modelResponse)
    ? modelResponse
    : Array.isArray((modelResponse as { data?: unknown[] }).data)
      ? (modelResponse as { data: unknown[] }).data
      : Array.isArray((modelResponse as { models?: unknown[] }).models)
        ? (modelResponse as { models: unknown[] }).models
        : [];
  const candidates = models
    .filter(isHedraImageModel)
    .filter((model) => {
      const resolutions = asStringArray(model.resolutions);
      const aspectRatios = asStringArray(model.aspect_ratios);

      return (
        isLikelyTextToImageHedraModel(model) &&
        supportsValue(resolutions, DEFAULT_HEDRA_RESOLUTION) &&
        supportsValue(aspectRatios, DEFAULT_HEDRA_ASPECT_RATIO)
      );
    })
    .sort((left, right) => scoreHedraImageModel(right) - scoreHedraImageModel(left));
  const id =
    candidates.length > 0 && typeof candidates[0].id === "string"
      ? candidates[0].id
      : null;

  if (typeof id !== "string") {
    throw new Error(
      "Unable to determine a Hedra text-to-image model. Set HEDRA_IMAGE_MODEL_ID or verify Hedra /models access.",
    );
  }

  cachedHedraModelId = id;
  return id;
}

async function pollHedraGeneration(generationId: string) {
  const deadline = Date.now() + DEFAULT_HEDRA_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await hedraFetchJson<unknown>(
      `/generations/${generationId}/status`,
      {},
      30_000,
    );
    const record = status as Record<string, unknown>;
    const statusText = String(record.status ?? record.state ?? "").toLowerCase();
    const url = findPreferredUrl(status);

    if (
      ["complete", "completed", "succeeded", "success", "ready"].includes(
        statusText,
      ) &&
      url
    ) {
      return url;
    }

    if (
      ["complete", "completed", "succeeded", "success", "ready"].includes(
        statusText,
      )
    ) {
      const assetId = getAssetId(status);

      if (!assetId) {
        throw new Error(
          `Hedra generation ${generationId} completed without a URL or asset_id.`,
        );
      }

      const assets = await hedraFetchJson<unknown>(
        `/assets?type=image&ids=${encodeURIComponent(assetId)}`,
        {},
        30_000,
      );
      const assetUrl = findPreferredUrl(assets);

      if (!assetUrl) {
        throw new Error(
          `Hedra generation ${generationId} completed but asset ${assetId} did not include a URL.`,
        );
      }

      return assetUrl;
    }

    if (["failed", "error", "cancelled", "canceled"].includes(statusText)) {
      throw new Error(
        `Hedra generation ${generationId} failed: ${
          record.error_message ?? record.error ?? "unknown error"
        }`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(`Hedra generation ${generationId} timed out.`);
}

export async function callHedraImageGenerator(input: {
  job: ImageJob;
  persona: ImagePersona;
  index: number;
}) {
  const prompt = buildPrompt(input.job, input.persona);
  const modelId = await getHedraImageModelId();
  const response = await hedraFetchJson<unknown>("/generations", {
    method: "POST",
    body: JSON.stringify({
      type: "image",
      ai_model_id: modelId,
      text_prompt: prompt,
      aspect_ratio: DEFAULT_HEDRA_ASPECT_RATIO,
      resolution: DEFAULT_HEDRA_RESOLUTION,
      batch_size: 1,
      enhance_prompt: true,
    }),
  });
  const generationId = getGenerationId(response);
  const immediateUrl = findFirstUrl(response);

  if (immediateUrl) {
    return immediateUrl;
  }

  if (!generationId) {
    throw new Error("Hedra response did not include a generation id or image URL.");
  }

  return pollHedraGeneration(generationId);
}

function extractFalImageUrl(result: unknown) {
  const data =
    result && typeof result === "object" && "data" in result
      ? (result as { data: unknown }).data
      : result;

  return findFirstUrl(data);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function callFalImageGenerator(input: {
  job: ImageJob;
  persona: ImagePersona;
  index: number;
}) {
  const apiKey = requireEnv("FAL_API_KEY");
  const prompt = buildPrompt(input.job, input.persona);
  const referenceImageUrls = input.persona.reference_image_urls ?? [];
  const configuredModel = process.env.FAL_IMAGE_MODEL;
  const candidateModels = configuredModel
    ? [configuredModel]
    : referenceImageUrls.length > 0
      ? [process.env.FAL_REFERENCE_IMAGE_MODEL ?? DEFAULT_FAL_REFERENCE_MODEL, DEFAULT_FAL_TEXT_MODEL]
      : [DEFAULT_FAL_TEXT_MODEL];

  fal.config({
    credentials: apiKey,
  });

  const errors: string[] = [];

  for (const model of candidateModels) {
    try {
      const usesReferenceInput =
        model !== DEFAULT_FAL_TEXT_MODEL && referenceImageUrls.length > 0;
      const result = await withTimeout(
        fal.subscribe(model, {
          input: usesReferenceInput
            ? {
                prompt,
                aspect_ratio: DEFAULT_HEDRA_ASPECT_RATIO,
                reference_image_urls: referenceImageUrls,
              }
            : {
                prompt,
                image_size: "portrait_16_9",
                num_images: 1,
                enable_safety_checker: true,
                output_format: "jpeg",
              },
          logs: false,
        }),
        DEFAULT_FAL_TIMEOUT_MS,
        `fal image generation (${model})`,
      );
      const url = extractFalImageUrl(result);

      if (!url) {
        throw new Error("response did not include an image URL");
      }

      return url;
    } catch (error) {
      errors.push(`${model}: ${getErrorMessage(error)}`);
    }
  }

  throw new Error(`fal image generation failed: ${errors.join(" | ")}`);
}

async function generateAndStoreWithSource(input: {
  job: ImageJob;
  persona: ImagePersona;
  source: AutomatedImageSource;
}) {
  const count = requiredImageCount(input.job.format);
  const assets: Tables<"assets">[] = [];

  for (let index = 0; index < count; index += 1) {
    const imageUrl =
      input.source === "hedra"
        ? await callHedraImageGenerator({ ...input, index })
        : await callFalImageGenerator({ ...input, index });
    const downloaded = await downloadImageBytes(imageUrl);
    const asset = await storeImageAsset({
      jobId: input.job.id,
      bytes: downloaded.bytes,
      contentType: downloaded.contentType,
      filename: `${input.source}-${index}.jpg`,
      promptUsed: buildPrompt(input.job, input.persona),
      validationNote: `Generated by ${input.source}.`,
    });

    assets.push(asset);
  }

  return assets;
}

export async function acquireImageAssets(
  input: GenerateInput,
): Promise<ImageAssetAcquisitionResult> {
  if (!["image", "carousel"].includes(input.job.format ?? "")) {
    throw new Error(
      `Image asset generation is not implemented for format ${input.job.format ?? "null"}.`,
    );
  }

  if (input.source === "hedra" || input.source === "fal") {
    const assets = await generateAndStoreWithSource({
      job: input.job,
      persona: input.persona,
      source: input.source,
    });

    return {
      assets,
      sourceUsed: input.source,
      costCredits: 0,
    };
  }

  try {
    const assets = await generateAndStoreWithSource({
      job: input.job,
      persona: input.persona,
      source: "hedra",
    });

    return {
      assets,
      sourceUsed: "hedra",
      costCredits: 0,
    };
  } catch (error) {
    const fallbackReason = getErrorMessage(error);
    await input.onFallback?.(fallbackReason);
    const assets = await generateAndStoreWithSource({
      job: input.job,
      persona: input.persona,
      source: "fal",
    });

    return {
      assets,
      sourceUsed: "fal",
      fallbackReason,
      costCredits: 0,
    };
  }
}
