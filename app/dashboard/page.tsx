import { ArrowRight, CheckCircle2, Clock3, FolderKanban } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAirtableStore } from "@/lib/airtable";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const store = getAirtableStore();

export default async function DashboardPage() {
  const [projects, items] = await Promise.all([
    store.listProjects(),
    store.listAllItems(),
  ]);

  const pendingCount = items.filter((item) => item.status === "Pending").length;
  const syncedCount = items.filter((item) => item.status === "Synced").length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total active memory</CardDescription>
            <CardTitle className="flex items-center gap-3 text-3xl">
              <FolderKanban className="size-8 text-[var(--accent)]" />
              {projects.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pending review items</CardDescription>
            <CardTitle className="flex items-center gap-3 text-3xl">
              <Clock3 className="size-8 text-[var(--warning)]" />
              {pendingCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Items already synced</CardDescription>
            <CardTitle className="flex items-center gap-3 text-3xl">
              <CheckCircle2 className="size-8 text-[var(--accent)]" />
              {syncedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="serif text-3xl font-medium">Projects</h2>
            <p className="text-sm text-[var(--foreground-soft)]">
              Ordered by most recent mapped activity.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/projects/new">Create project</Link>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const projectItems = items.filter(
              (item) => item.projectRecordId === project.recordId,
            );
            const pendingItems = projectItems.filter(
              (item) => item.status === "Pending",
            );

            return (
              <Card key={project.recordId} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-2xl">{project.name}</CardTitle>
                      <CardDescription>
                        {project.clientName ?? "Unknown client"} •{" "}
                        {project.phase ?? "No phase"} •{" "}
                        {project.status ?? "Active"}
                      </CardDescription>
                    </div>
                    <Button asChild variant="ghost" className="shrink-0">
                      <Link href={`/dashboard/projects/${project.recordId}`}>
                        Open
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
                        Pending
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {pendingItems.length}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
                        Budget
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatCurrency(project.budget)}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
                        Last activity
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {formatDateTime(project.lastActivity)}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-[var(--foreground-soft)]">
                    {project.contextNotes
                      ? project.contextNotes
                      : "No operator context notes yet for this project."}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
