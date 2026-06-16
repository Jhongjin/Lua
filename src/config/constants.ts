export const JOB_STATUSES = [
  "QUEUED",
  "PLANNED",
  "ASSETS_GENERATING",
  "ASSETS_READY",
  "EDITING",
  "EDITED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_FLOW = [
  "QUEUED",
  "PLANNED",
  "ASSETS_GENERATING",
  "ASSETS_READY",
  "EDITING",
  "EDITED",
  "PENDING_REVIEW",
  "APPROVED",
  "PUBLISHING",
  "PUBLISHED",
] as const satisfies readonly JobStatus[];

export const REVIEW_DECISION_STATUSES = ["APPROVED", "REJECTED"] as const;

export const CONTENT_AXES = ["daily", "office", "food", "beauty"] as const;
export type ContentAxis = (typeof CONTENT_AXES)[number];

export const CONTENT_FORMATS = ["image", "carousel", "reels"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const ASSET_TYPES = ["image", "video"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const IMAGE_SOURCES = ["manual", "hedra", "fal", "auto"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

export const VIDEO_SOURCES = ["manual", "veo", "auto"] as const;
export type VideoSource = (typeof VIDEO_SOURCES)[number];

export const PLATFORMS = ["instagram", "youtube", "tiktok", "x"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PUBLICATION_STATUSES = ["pending", "success", "failed"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const DEFAULT_TARGET_PLATFORMS = [
  "instagram",
  "youtube",
  "tiktok",
  "x",
] as const satisfies readonly Platform[];

export const DEFAULT_LUA_PERSONA_ID =
  "11111111-1111-4111-8111-111111111111";

export const PLAN_CONTENT_EVENT_NAME = "lua/content.plan.requested";
export const GENERATE_ASSETS_EVENT_NAME = "lua/assets.generate.requested";
export const EDIT_CONTENT_EVENT_NAME = "lua/content.edit.requested";
export const REQUEST_REVIEW_EVENT_NAME = "lua/review.requested";
export const PUBLISH_CONTENT_EVENT_NAME = "lua/content.publish.requested";

export const ASSET_STORAGE_BUCKET = "lua-assets";
export const MIN_IMAGE_WIDTH = 720;
export const MIN_IMAGE_HEIGHT = 720;
export const REQUIRED_CAROUSEL_IMAGE_COUNT = 2;
export const MAX_REELS_DURATION_SECONDS = 60;
export const TARGET_REELS_ASPECT_RATIO = 9 / 16;
export const REELS_ASPECT_RATIO_TOLERANCE = 0.04;
