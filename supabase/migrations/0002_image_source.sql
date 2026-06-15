-- ============================================
-- Migration 0002: image source selection
-- LUA AI Influencer Automation Platform
-- ============================================

create type image_source as enum ('manual', 'hedra', 'fal', 'auto');

alter table content_jobs
  add column image_source image_source not null default 'auto';

create index idx_content_jobs_image_source on content_jobs(image_source);
