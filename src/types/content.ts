import { CONTENT_AXES, CONTENT_FORMATS } from "@/config/constants";
import type { ContentAxis, ContentFormat } from "@/config/constants";

export type ContentPlan = {
  title: string;
  concept: string;
  content_axis: ContentAxis;
  format: ContentFormat;
  image_prompt: string;
  video_prompt: string;
  captions_on_screen: string[];
  instagram_caption: string;
  youtube_title: string;
  youtube_description: string;
  hashtags_instagram: string[];
  hashtags_youtube: string[];
  best_post_time: string;
  ai_disclosure: boolean;
};

export const contentPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "concept",
    "content_axis",
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
  ],
  properties: {
    title: { type: "string" },
    concept: { type: "string" },
    content_axis: { type: "string", enum: CONTENT_AXES },
    format: { type: "string", enum: CONTENT_FORMATS },
    image_prompt: { type: "string" },
    video_prompt: { type: "string" },
    captions_on_screen: { type: "array", items: { type: "string" } },
    instagram_caption: { type: "string" },
    youtube_title: { type: "string" },
    youtube_description: { type: "string" },
    hashtags_instagram: { type: "array", items: { type: "string" } },
    hashtags_youtube: { type: "array", items: { type: "string" } },
    best_post_time: { type: "string" },
    ai_disclosure: { type: "boolean" },
  },
} as const;
