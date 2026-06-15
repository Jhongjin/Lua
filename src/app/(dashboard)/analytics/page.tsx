export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Performance
        </p>
        <h1 className="mt-2 text-3xl font-semibold">성과 대시보드</h1>
      </div>
      <section className="rounded-lg border border-border bg-surface p-8 text-muted">
        수집된 성과 데이터가 없습니다.
      </section>
    </div>
  );
}
