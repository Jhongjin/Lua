export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Schedule
        </p>
        <h1 className="mt-2 text-3xl font-semibold">콘텐츠 캘린더</h1>
      </div>
      <section className="rounded-lg border border-border bg-surface p-8 text-muted">
        예정된 콘텐츠가 없습니다.
      </section>
    </div>
  );
}
