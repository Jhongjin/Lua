import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(dashboard)/actions";
import { createAuthenticatedServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createAuthenticatedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/review");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-lg font-semibold" href="/review">
              LUA Automation
            </Link>
            <p className="mt-1 font-mono text-xs text-muted">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex rounded-md border border-border bg-background p-1 text-sm">
              <Link
                className="rounded px-3 py-2 transition hover:bg-surface-muted"
                href="/review"
              >
                Review
              </Link>
              <Link
                className="rounded px-3 py-2 transition hover:bg-surface-muted"
                href="/calendar"
              >
                Calendar
              </Link>
              <Link
                className="rounded px-3 py-2 transition hover:bg-surface-muted"
                href="/analytics"
              >
                Analytics
              </Link>
            </nav>
            <form action={signOut}>
              <button
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm transition hover:bg-surface-muted"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
