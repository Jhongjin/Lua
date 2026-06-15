import Link from "next/link";
import { JOB_STATUSES, type JobStatus } from "@/config/constants";
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
      "id,status,title,concept,axis,format,scheduled_at,created_at,retry_count,max_retries,error_message",
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
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Content Jobs
          </p>
          <h1 className="mt-2 text-3xl font-semibold">검수 대시보드</h1>
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
                  </td>
                  <td className="max-w-lg px-4 py-4 align-top">
                    <div className="font-medium">
                      {job.title ?? "Untitled content job"}
                    </div>
                    <div className="mt-1 line-clamp-2 text-muted">
                      {job.concept ?? job.error_message ?? job.id}
                    </div>
                    <div className="mt-2 font-mono text-xs text-muted">
                      {formatDate(job.created_at)}
                    </div>
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
