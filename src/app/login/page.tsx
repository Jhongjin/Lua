import { signInWithPassword } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/review";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            LUA Ops
          </p>
          <h1 className="mt-3 text-2xl font-semibold">로그인</h1>
        </div>

        <form action={signInWithPassword} className="space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {params.error ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              로그인 정보를 확인해주세요.
            </p>
          ) : null}
          <button
            className="h-11 w-full rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:brightness-95"
            type="submit"
          >
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
