import Link from "next/link";
import { JOB_STATUSES, type JobStatus } from "@/config/constants";
import {
  triggerManualContentPlan,
  uploadManualImagesForJob,
} from "@/app/(dashboard)/review/actions";
import { VideoUploadForm } from "@/app/(dashboard)/review/video-upload-form";
import { createAuthenticatedServerClient } from "@/lib/supabase/server";

type ReviewPageProps = {
  searchParams: Promise<{
    status?: string | string[];
  }>;
};

function getStatusFilter(status: string | string[] | undefined) {
  const value = Array.isArray(status) ? status[0] : status;

  if (JOB_STATUSES.includes(value as JobStatus)) {
    return value as JobStatus;
  }

  return undefined;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const statusFilter = getStatusFilter(params.status);
  const supabase = await createAuthenticatedServerClient();

  let query = supabase
    .from("content_jobs")
    .select(
      "id,status,title,concept,axis,format,image_source,video_source,image_prompt,video_prompt,instagram_caption,youtube_title,hashtags_instagram,final_image_urls,final_video_url,scheduled_at,created_at,retry_count,max_retries,error_message,review_note",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: jobs, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Content Jobs
            </p>
            <h1 className="mt-2 text-3xl font-semibold">검수 대시보드</h1>
          </div>
          <form action={triggerManualContentPlan}>
            <button
              className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
              type="submit"
            >
              기획안 생성
            </button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={`rounded-md border px-3 py-2 text-sm ${
              !statusFilter
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface hover:bg-surface-muted"
            }`}
            href="/review"
          >
            All
          </Link>
          {JOB_STATUSES.map((status) => (
            <Link
              className={`rounded-md border px-3 py-2 font-mono text-xs ${
                statusFilter === status
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-surface hover:bg-surface-muted"
              }`}
              href={`/review?status=${status}`}
              key={status}
            >
              {status}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {error.message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Axis</th>
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Retry</th>
                <th className="px-4 py-3 font-medium">Review</th>
              </tr>
            </thead>
            <tbody>
              {(jobs ?? []).map((job) => (
                <tr className="border-b border-border last:border-0" key={job.id}>
                  <td className="px-4 py-4 align-top font-mono text-xs">
                    {job.status}
                    <div className="mt-2 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted">
                      {job.format === "reels"
                        ? `video:${job.video_source}`
                        : `image:${job.image_source}`}
                    </div>
                  </td>
                  <td className="max-w-lg px-4 py-4 align-top">
                    <div className="font-medium">
                      {job.title ?? "Untitled content job"}
                    </div>
                    <div className="mt-1 line-clamp-2 text-muted">
                      {job.concept ?? job.error_message ?? job.id}
                    </div>
                    {job.youtube_title ? (
                      <div className="mt-2 text-sm">
                        YouTube: {job.youtube_title}
                      </div>
                    ) : null}
                    {job.instagram_caption ? (
                      <div className="mt-2 line-clamp-2 text-muted">
                        Instagram: {job.instagram_caption}
                      </div>
                    ) : null}
                    {job.image_prompt && job.format !== "reels" ? (
                      <div className="mt-2 line-clamp-2 font-mono text-xs text-muted">
                        {job.image_prompt}
                      </div>
                    ) : null}
                    {job.video_prompt && job.format === "reels" ? (
                      <div className="mt-2 line-clamp-2 font-mono text-xs text-muted">
                        {job.video_prompt}
                      </div>
                    ) : null}
                    {job.hashtags_instagram?.length ? (
                      <div className="mt-2 flex max-w-xl flex-wrap gap-1">
                        {job.hashtags_instagram.slice(0, 8).map((tag) => (
                          <span
                            className="rounded border border-border bg-background px-2 py-1 font-mono text-xs text-muted"
                            key={tag}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 font-mono text-xs text-muted">
                      {formatDate(job.created_at)}
                    </div>
                    {job.review_note ? (
                      <div className="mt-2 text-sm text-muted">{job.review_note}</div>
                    ) : null}
                    {job.final_image_urls?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {job.final_image_urls.map((url, index) => (
                          <a
                            className="rounded border border-border bg-background px-2 py-1 text-xs text-muted hover:text-foreground"
                            href={url}
                            key={url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Final {index + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {job.final_video_url ? (
                      <div className="mt-3 max-w-xs space-y-2">
                        <video
                          className="aspect-[9/16] max-h-64 rounded-md border border-border bg-background object-cover"
                          controls
                          preload="metadata"
                          src={job.final_video_url}
                        />
                        <a
                          className="inline-flex rounded border border-border bg-background px-2 py-1 text-xs text-muted hover:text-foreground"
                          href={job.final_video_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          영상 열기
                        </a>
                      </div>
                    ) : null}
                    {job.image_source === "manual" &&
                    ["PLANNED", "FAILED"].includes(job.status) &&
                    ["image", "carousel"].includes(job.format ?? "") ? (
                      <form
                        action={uploadManualImagesForJob}
                        className="mt-3 flex flex-wrap items-center gap-2"
                      >
                        <input name="jobId" type="hidden" value={job.id} />
                        <input
                          accept="image/*"
                          className="max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
                          multiple={job.format === "carousel"}
                          name="images"
                          type="file"
                        />
                        <button
                          className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
                          type="submit"
                        >
                          이미지 업로드
                        </button>
                      </form>
                    ) : null}
                    {job.format === "reels" &&
                    job.video_source === "manual" &&
                    ["PLANNED", "FAILED"].includes(job.status) ? (
                      <VideoUploadForm jobId={job.id} />
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top">{job.axis ?? "-"}</td>
                  <td className="px-4 py-4 align-top">{job.format ?? "-"}</td>
                  <td className="px-4 py-4 align-top">
                    {formatDate(job.scheduled_at)}
                  </td>
                  <td className="px-4 py-4 align-top font-mono text-xs">
                    {job.retry_count ?? 0}/{job.max_retries ?? 3}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex gap-2">
                      <button
                        className="h-9 rounded-md border border-border px-3 text-sm text-muted"
                        disabled
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="h-9 rounded-md border border-border px-3 text-sm text-muted"
                        disabled
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!error && (jobs ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted" colSpan={7}>
                    콘텐츠 잡이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
