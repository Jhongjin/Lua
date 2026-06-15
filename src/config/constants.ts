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
