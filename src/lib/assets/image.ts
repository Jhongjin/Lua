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
const DEFAULT_FAL_TEXT_MODEL = "fal-ai/nano-banana-2";
const DEFAULT_FAL_REFERENCE_MODEL = "fal-ai/vidu/q2/reference-to-image";

let cachedHedraModelId: string | null = null;

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
  const imageModel = models.find((model) => {
    if (!model || typeof model !== "object") {
      return false;
    }

    const record = model as Record<string, unknown>;
    return String(record.type ?? record.kind ?? record.mode ?? "")
      .toLowerCase()
      .includes("image");
  });
  const fallbackModel = models[0];
  const id =
    imageModel && typeof imageModel === "object"
      ? (imageModel as Record<string, unknown>).id
      : fallbackModel && typeof fallbackModel === "object"
        ? (fallbackModel as Record<string, unknown>).id
        : null;

  if (typeof id !== "string") {
    throw new Error(
      "Unable to determine Hedra image model. Set HEDRA_IMAGE_MODEL_ID or verify Hedra /models access.",
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
    const url = findFirstUrl(status);

    if (
      ["complete", "completed", "succeeded", "success", "ready"].includes(
        statusText,
      ) &&
      url
    ) {
      return url;
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
      aspect_ratio: "9:16",
      resolution: "1080p",
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
  const model =
    process.env.FAL_IMAGE_MODEL ??
    (referenceImageUrls.length > 0
      ? DEFAULT_FAL_REFERENCE_MODEL
      : DEFAULT_FAL_TEXT_MODEL);

  fal.config({
    credentials: apiKey,
  });

  const result = await withTimeout(
    fal.subscribe(model, {
      input: {
        prompt,
        aspect_ratio: "9:16",
        ...(referenceImageUrls.length > 0 ? { reference_image_urls: referenceImageUrls } : {}),
      },
      logs: false,
    }),
    DEFAULT_FAL_TIMEOUT_MS,
    "fal image generation",
  );
  const url = extractFalImageUrl(result);

  if (!url) {
    throw new Error("fal response did not include an image URL.");
  }

  return url;
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
