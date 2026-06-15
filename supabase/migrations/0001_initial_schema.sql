-- ============================================
-- Migration 0001: initial schema
-- LUA AI Influencer Automation Platform
-- ============================================

-- 확장
create extension if not exists "uuid-ossp";

-- ============================================
-- ENUM 타입 (상태 기계 강제)
-- ============================================
create type job_status as enum (
  'QUEUED',
  'PLANNED',
  'ASSETS_GENERATING',
  'ASSETS_READY',
  'EDITING',
  'EDITED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED'
);

create type content_axis as enum ('daily', 'office', 'food', 'beauty');
create type content_format as enum ('image', 'carousel', 'reels');
create type asset_type as enum ('image', 'video');
create type platform as enum ('instagram', 'youtube', 'tiktok', 'x');
create type publication_status as enum ('pending', 'success', 'failed');

-- ============================================
-- 1. personas : 캐릭터 설정 (멀티테넌트 기반)
-- ============================================
create table personas (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  handle text,
  description text,                       -- 페르소나 서술
  tone text,                              -- 말투/톤 가이드
  content_axes content_axis[] default '{daily,office,food,beauty}',
  forbidden_rules text,                   -- 금지사항
  reference_image_urls text[],            -- 얼굴 일관성용 레퍼런스
  visual_guide text,                      -- 비주얼 공통 키워드
  active_prompt_template_id uuid,         -- 현재 사용 중인 시스템 프롬프트
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. prompt_templates : 시스템 프롬프트 버전 관리
-- ============================================
create table prompt_templates (
  id uuid primary key default uuid_generate_v4(),
  persona_id uuid references personas(id) on delete cascade,
  version text not null,                  -- 예: 'v1.0'
  system_prompt text not null,            -- LLM에 넣는 시스템 프롬프트
  output_schema jsonb,                    -- 기대 JSON 스키마
  notes text,
  is_active boolean default false,
  created_at timestamptz default now(),
  unique (persona_id, version)
);

-- persona가 현재 쓰는 템플릿 참조 (FK 추가)
alter table personas
  add constraint fk_active_prompt_template
  foreign key (active_prompt_template_id)
  references prompt_templates(id) on delete set null;

-- ============================================
-- 3. content_jobs : 콘텐츠 잡 (상태 기계 중심)
-- ============================================
create table content_jobs (
  id uuid primary key default uuid_generate_v4(),
  persona_id uuid not null references personas(id) on delete cascade,
  prompt_template_id uuid references prompt_templates(id) on delete set null,
  status job_status not null default 'QUEUED',

  -- 기획 모듈 산출물 (JSON 스키마 매핑)
  title text,
  concept text,
  axis content_axis,
  format content_format,
  image_prompt text,
  video_prompt text,
  captions_on_screen text[],
  instagram_caption text,
  youtube_title text,
  youtube_description text,
  hashtags_instagram text[],
  hashtags_youtube text[],
  best_post_time text,
  ai_disclosure boolean default true,

  -- 후처리 결과
  final_video_url text,                   -- 자막/포맷 완료 영상
  final_image_urls text[],                -- 단일/캐러셀 이미지

  -- 스케줄링
  scheduled_at timestamptz,               -- 게시 예정 시각
  target_platforms platform[] default '{instagram,youtube,tiktok,x}',

  -- 하네스 제어
  retry_count int default 0,
  max_retries int default 3,
  error_message text,
  review_note text,                       -- 반려 시 수정 요청

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);

create index idx_content_jobs_status on content_jobs(status);
create index idx_content_jobs_persona on content_jobs(persona_id);
create index idx_content_jobs_scheduled on content_jobs(scheduled_at);

-- ============================================
-- 4. assets : 생성된 이미지/영상 메타데이터
-- ============================================
create table assets (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references content_jobs(id) on delete cascade,
  type asset_type not null,
  storage_path text not null,             -- Supabase Storage 경로
  public_url text,
  prompt_used text,                       -- 실제 사용된 프롬프트
  width int,
  height int,
  duration_seconds numeric,               -- 영상일 때
  validation_passed boolean default false,
  validation_note text,                   -- 검증 게이트 결과(해상도/얼굴유사도 등)
  face_similarity numeric,                -- 레퍼런스 대비 유사도(선택)
  created_at timestamptz default now()
);

create index idx_assets_job on assets(job_id);

-- ============================================
-- 5. publications : 플랫폼별 게시 결과
-- ============================================
create table publications (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references content_jobs(id) on delete cascade,
  platform platform not null,
  status publication_status not null default 'pending',
  external_post_id text,                  -- 플랫폼 게시물 ID
  post_url text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz default now(),
  unique (job_id, platform)
);

create index idx_publications_job on publications(job_id);

-- ============================================
-- 6. analytics : 게시물 성과 시계열
-- ============================================
create table analytics (
  id uuid primary key default uuid_generate_v4(),
  publication_id uuid not null references publications(id) on delete cascade,
  platform platform not null,
  views int default 0,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  saves int default 0,
  watch_completion_rate numeric,          -- 완주율(영상)
  follower_delta int default 0,           -- 수집 시점 팔로워 증감
  collected_at timestamptz default now()
);

create index idx_analytics_publication on analytics(publication_id);
create index idx_analytics_collected on analytics(collected_at);

-- ============================================
-- 7. job_logs : 관찰성 (단계별 로그/비용)
-- ============================================
create table job_logs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references content_jobs(id) on delete cascade,
  step text not null,                     -- 예: 'plan', 'generate_image', 'publish'
  status text not null,                   -- 'started','success','failed','retry'
  message text,
  duration_ms int,
  cost_credits numeric,                   -- API 비용 추적
  created_at timestamptz default now()
);

create index idx_job_logs_job on job_logs(job_id);

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;

$$ language plpgsql;

create trigger trg_personas_updated
  before update on personas
  for each row execute function set_updated_at();

create trigger trg_content_jobs_updated
  before update on content_jobs
  for each row execute function set_updated_at();

-- ============================================
-- RLS 활성화
-- ============================================
alter table personas enable row level security;
alter table prompt_templates enable row level security;
alter table content_jobs enable row level security;
alter table assets enable row level security;
alter table publications enable row level security;
alter table analytics enable row level security;
alter table job_logs enable row level security;

-- 인증된 사용자(검수자/운영자)는 읽기 가능
create policy "authenticated read personas"
  on personas for select to authenticated using (true);
create policy "authenticated read jobs"
  on content_jobs for select to authenticated using (true);
create policy "authenticated update jobs (review)"
  on content_jobs for update to authenticated using (true);
create policy "authenticated read assets"
  on assets for select to authenticated using (true);
create policy "authenticated read publications"
  on publications for select to authenticated using (true);
create policy "authenticated read analytics"
  on analytics for select to authenticated using (true);

-- 백엔드(service_role)는 RLS를 우회하므로 별도 정책 불필요.
-- 쓰기/파이프라인 작업은 service_role 키를 쓰는 서버에서 수행.
