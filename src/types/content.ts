import { CONTENT_AXES, CONTENT_FORMATS } from "@/config/constants";
import type { ContentAxis, ContentFormat } from "@/config/constants";
import type { Tables } from "@/types/database";

// Goal: keep the DB content_jobs planning columns, this type, and the
// prompt_templates v1.0 JSON contract on the same field set.
export const CONTENT_PLAN_FIELDS = [
  "title",
  "concept",
  "axis",
  "format",
  "image_prompt",
  "video_prompt",
  "captions_on_screen",
  "instagram_caption",
  "youtube_title",
  "youtube_description",
  "hashtags_instagram",
  "hashtags_youtube",
  "best_post_time",
  "ai_disclosure",
] as const satisfies readonly (keyof Tables<"content_jobs">)[];

type ContentPlanField = (typeof CONTENT_PLAN_FIELDS)[number];
type ContentJobPlanColumns = Pick<Tables<"content_jobs">, ContentPlanField>;

export type ContentPlan = {
  [Field in ContentPlanField]: NonNullable<ContentJobPlanColumns[Field]>;
};

type JsonSchemaProperty =
  | {
      type: "array";
      items: { type: "string" };
      description?: string;
    }
  | {
      type: "boolean";
      description?: string;
    }
  | {
      type: "string";
      enum?: readonly string[];
      description?: string;
    };

const contentPlanProperties = {
  title: {
    type: "string",
    description: "내부 식별용 제목",
  },
  concept: { type: "string" },
  axis: {
    type: "string",
    enum: CONTENT_AXES,
    description: "content_jobs.axis와 동일한 콘텐츠 축",
  },
  format: { type: "string", enum: CONTENT_FORMATS },
  image_prompt: { type: "string" },
  video_prompt: { type: "string" },
  captions_on_screen: { type: "array", items: { type: "string" } },
  instagram_caption: { type: "string" },
  youtube_title: {
    type: "string",
    description: "유튜브용 공개 제목",
  },
  youtube_description: { type: "string" },
  hashtags_instagram: { type: "array", items: { type: "string" } },
  hashtags_youtube: { type: "array", items: { type: "string" } },
  best_post_time: { type: "string" },
  ai_disclosure: { type: "boolean" },
} as const satisfies Record<ContentPlanField, JsonSchemaProperty>;

export const contentPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: CONTENT_PLAN_FIELDS,
  properties: contentPlanProperties,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  input: Record<string, unknown>,
  field: ContentPlanField,
  errors: string[],
) {
  const value = input[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string.`);
    return "";
  }

  return value.trim();
}

function readStringArray(
  input: Record<string, unknown>,
  field: ContentPlanField,
  errors: string[],
) {
  const value = input[field];

  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    errors.push(`${field} must be a non-empty string array.`);
    return [];
  }

  return value.map((item) => item.trim());
}

function readAxis(input: Record<string, unknown>, errors: string[]) {
  const value = readString(input, "axis", errors);

  if (!CONTENT_AXES.includes(value as ContentAxis)) {
    errors.push(`axis must be one of: ${CONTENT_AXES.join(", ")}.`);
  }

  return value as ContentAxis;
}

function readFormat(input: Record<string, unknown>, errors: string[]) {
  const value = readString(input, "format", errors);

  if (!CONTENT_FORMATS.includes(value as ContentFormat)) {
    errors.push(`format must be one of: ${CONTENT_FORMATS.join(", ")}.`);
  }

  return value as ContentFormat;
}

function readBoolean(
  input: Record<string, unknown>,
  field: ContentPlanField,
  errors: string[],
) {
  const value = input[field];

  if (typeof value !== "boolean") {
    errors.push(`${field} must be a boolean.`);
    return false;
  }

  return value;
}

export function parseContentPlan(input: unknown): ContentPlan {
  if (!isRecord(input)) {
    throw new Error("Content plan must be a JSON object.");
  }

  const errors: string[] = [];

  for (const field of CONTENT_PLAN_FIELDS) {
    if (!(field in input)) {
      errors.push(`Missing required field: ${field}.`);
    }
  }

  const plan: ContentPlan = {
    title: readString(input, "title", errors),
    concept: readString(input, "concept", errors),
    axis: readAxis(input, errors),
    format: readFormat(input, errors),
    image_prompt: readString(input, "image_prompt", errors),
    video_prompt: readString(input, "video_prompt", errors),
    captions_on_screen: readStringArray(input, "captions_on_screen", errors),
    instagram_caption: readString(input, "instagram_caption", errors),
    youtube_title: readString(input, "youtube_title", errors),
    youtube_description: readString(input, "youtube_description", errors),
    hashtags_instagram: readStringArray(input, "hashtags_instagram", errors),
    hashtags_youtube: readStringArray(input, "hashtags_youtube", errors),
    best_post_time: readString(input, "best_post_time", errors),
    ai_disclosure: readBoolean(input, "ai_disclosure", errors),
  };

  if (errors.length > 0) {
    throw new Error(`Content plan schema mismatch: ${errors.join(" ")}`);
  }

  return plan;
}
