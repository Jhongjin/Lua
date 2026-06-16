do $$
begin
  create type video_source as enum ('manual', 'veo', 'auto');
exception
  when duplicate_object then null;
end $$;

alter table content_jobs
  add column if not exists video_source video_source not null default 'manual';

create index if not exists idx_content_jobs_video_source
  on content_jobs(video_source);
