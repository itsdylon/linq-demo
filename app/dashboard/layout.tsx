import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { logoutAction } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="page-shell">
      <header className="border-b border-[var(--border)] bg-white/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--foreground-soft)]">
              Thread operator console
            </p>
            <div>
              <h1 className="serif text-4xl font-medium tracking-tight text-[var(--foreground)]">
                Review what happened in the blue bubbles.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--foreground-soft)]">
                Linq webhooks land here, Claude pulls structured updates, and
                Airtable remains the reviewable system behind the scenes.
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/dashboard">Projects</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard/unmapped">Unmapped chats</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/projects/new">New project</Link>
            </Button>
            <form action={logoutAction}>
              <Button variant="outline" type="submit">
                Log out
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10">{children}</main>
    </div>
  );
}
