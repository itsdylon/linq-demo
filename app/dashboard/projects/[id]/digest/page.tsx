import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAirtableStore } from "@/lib/airtable";
import { formatDateTime } from "@/lib/utils";
import {
  confirmDigestSyncAction,
  generateDigestAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

const store = getAirtableStore();

export default async function DigestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string; state?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [project, runs] = await Promise.all([
    store.getProjectById(id),
    store.listProjectDigestRuns(id),
  ]);

  if (!project) {
    notFound();
  }

  const run =
    (query.run
      ? runs.find((entry) => entry.recordId === query.run)
      : runs[0]) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="serif text-3xl font-medium">Digest handoff</h2>
        <p className="mt-2 text-sm text-[var(--foreground-soft)]">
          Generate markdown for manual paste into Programa, then mark the
          included items synced once the handoff is done.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>
              {project.clientName ?? "Unknown client"} •{" "}
              {project.phase ?? "No phase"}
            </CardDescription>
          </div>
          <form action={generateDigestAction}>
            <input type="hidden" name="projectId" value={project.recordId} />
            <Button type="submit">Generate new digest</Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.state === "empty" ? (
            <div className="rounded-3xl bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
              No accepted or edited items were eligible for a new digest run.
            </div>
          ) : null}

          {!run ? (
            <div className="rounded-3xl bg-white/70 px-5 py-10 text-center text-sm text-[var(--foreground-soft)]">
              No digest has been generated for this project yet.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-[var(--foreground-soft)]">
                  Generated {formatDateTime(run.generatedAt)}
                  {run.confirmedSyncedAt
                    ? ` • Synced ${formatDateTime(run.confirmedSyncedAt)}`
                    : " • Awaiting sync confirmation"}
                </div>
                <CopyButton text={run.digestMarkdown} />
              </div>

              <pre className="prose-digest rounded-[28px] bg-[var(--foreground)] px-5 py-5 text-sm leading-7 text-[var(--accent-foreground)]">
                {run.digestMarkdown}
              </pre>

              {!run.confirmedSyncedAt ? (
                <form action={confirmDigestSyncAction}>
                  <input
                    type="hidden"
                    name="digestRunId"
                    value={run.recordId}
                  />
                  <input
                    type="hidden"
                    name="projectId"
                    value={project.recordId}
                  />
                  <Button type="submit" variant="secondary">
                    Mark included items synced
                  </Button>
                </form>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
