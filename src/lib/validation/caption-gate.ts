import {
  CONTENT_AXES,
  CONTENT_FORMATS,
  type ContentAxis,
  type ContentFormat,
} from "@/config/constants";
import { CONTENT_PLAN_FIELDS, type ContentPlan } from "@/types/content";

const DEFAULT_FORBIDDEN_TERMS = [
  "정치",
  "종교",
  "논쟁",
  "비방",
  "혐오",
  "확실한 수익",
  "투자 조언",
  "의학적 조언",
  "다이어트 보장",
  "무조건 살빠",
  "실존 인물",
];

const LIMITS = {
  title: 80,
  youtubeTitle: 100,
  instagramCaption: 2_200,
  youtubeDescription: 5_000,
  onScreenCaption: 45,
  instagramHashtagsMin: 3,
  instagramHashtagsMax: 30,
  youtubeHashtagsMin: 1,
  youtubeHashtagsMax: 15,
};

export type CaptionGateResult =
  | {
      ok: true;
      reasons: [];
    }
  | {
      ok: false;
      reasons: string[];
    };

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTextArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function pushLengthError(
  errors: string[],
  field: string,
  value: string,
  maxLength: number,
) {
  if (value.length > maxLength) {
    errors.push(`${field} is too long (${value.length}/${maxLength}).`);
  }
}

function validateHashtagCount(
  errors: string[],
  field: string,
  value: string[],
  min: number,
  max: number,
) {
  if (value.length < min || value.length > max) {
    errors.push(`${field} count must be between ${min} and ${max}.`);
  }
}

function validateForbiddenTerms(
  errors: string[],
  plan: ContentPlan,
  forbiddenTerms: string[],
) {
  const searchable = [
    plan.title,
    plan.concept,
    plan.image_prompt,
    plan.video_prompt,
    plan.instagram_caption,
    plan.youtube_title,
    plan.youtube_description,
    ...plan.captions_on_screen,
    ...plan.hashtags_instagram,
    ...plan.hashtags_youtube,
  ].join("\n");

  for (const term of forbiddenTerms) {
    if (searchable.includes(term)) {
      errors.push(`Forbidden term detected: ${term}.`);
    }
  }
}

export function validateContentPlan(
  plan: ContentPlan,
  options: {
    forbiddenTerms?: string[];
  } = {},
): CaptionGateResult {
  const errors: string[] = [];
  const valueByField = plan as unknown as Record<string, unknown>;

  for (const field of CONTENT_PLAN_FIELDS) {
    const value = valueByField[field];
    const isArrayField =
      field === "captions_on_screen" ||
      field === "hashtags_instagram" ||
      field === "hashtags_youtube";

    if (isArrayField && !hasTextArray(value)) {
      errors.push(`Missing or invalid required field: ${field}.`);
    } else if (field === "ai_disclosure" && typeof value !== "boolean") {
      errors.push(`Missing or invalid required field: ${field}.`);
    } else if (
      !isArrayField &&
      field !== "ai_disclosure" &&
      !hasText(value)
    ) {
      errors.push(`Missing or invalid required field: ${field}.`);
    }
  }

  if (!CONTENT_AXES.includes(plan.axis as ContentAxis)) {
    errors.push(`Invalid axis: ${plan.axis}.`);
  }

  if (!CONTENT_FORMATS.includes(plan.format as ContentFormat)) {
    errors.push(`Invalid format: ${plan.format}.`);
  }

  pushLengthError(errors, "title", plan.title, LIMITS.title);
  pushLengthError(
    errors,
    "youtube_title",
    plan.youtube_title,
    LIMITS.youtubeTitle,
  );
  pushLengthError(
    errors,
    "instagram_caption",
    plan.instagram_caption,
    LIMITS.instagramCaption,
  );
  pushLengthError(
    errors,
    "youtube_description",
    plan.youtube_description,
    LIMITS.youtubeDescription,
  );

  plan.captions_on_screen.forEach((caption, index) => {
    pushLengthError(
      errors,
      `captions_on_screen[${index}]`,
      caption,
      LIMITS.onScreenCaption,
    );
  });

  if (plan.ai_disclosure !== true) {
    errors.push("ai_disclosure must be true.");
  }

  validateHashtagCount(
    errors,
    "hashtags_instagram",
    plan.hashtags_instagram,
    LIMITS.instagramHashtagsMin,
    LIMITS.instagramHashtagsMax,
  );
  validateHashtagCount(
    errors,
    "hashtags_youtube",
    plan.hashtags_youtube,
    LIMITS.youtubeHashtagsMin,
    LIMITS.youtubeHashtagsMax,
  );

  validateForbiddenTerms(
    errors,
    plan,
    options.forbiddenTerms ?? DEFAULT_FORBIDDEN_TERMS,
  );

  return errors.length === 0
    ? { ok: true, reasons: [] }
    : { ok: false, reasons: errors };
}

export const validateCaptions = validateContentPlan;
