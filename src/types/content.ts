import { CONTENT_AXES, CONTENT_FORMATS } from "@/config/constants";
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
