import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAirtableStore } from "@/lib/airtable";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getConfidenceTone,
} from "@/lib/utils";
import {
  acceptItemAction,
  bulkAcceptProjectItemsAction,
  generateDigestAction,
  rejectItemAction,
  updateItemAction,
  updateProjectAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const store = getAirtableStore();

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, items, participants, digestRuns] = await Promise.all([
    store.getProjectById(id),
    store.listProjectItems(id),
    store.listProjectParticipants(id),
    store.listProjectDigestRuns(id),
  ]);

  if (!project) {
    notFound();
  }

  const activeItems = items.filter((item) => item.status !== "Synced");
  const latestDigest = digestRuns[0];

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="accent">{project.phase ?? "No phase"}</Badge>
                  <Badge>{project.status ?? "Active"}</Badge>
                  <Badge>{activeItems.length} active items</Badge>
                </div>
                <CardTitle className="serif text-4xl font-medium">
                  {project.name}
                </CardTitle>
                <CardDescription>
                  {project.clientName ?? "Unknown client"} •{" "}
                  {project.address ?? "No address"}
                </CardDescription>
              </div>
              <form action={generateDigestAction}>
                <input
                  type="hidden"
                  name="projectId"
                  value={project.recordId}
                />
                <Button type="submit">Generate digest</Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
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
                Chats bound
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {project.linqChatIds.length}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator context</CardTitle>
            <CardDescription>
              Update the project metadata and free-form context that gets fed
              into extraction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProjectAction} className="space-y-4">
              <input type="hidden" name="projectId" value={project.recordId} />
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="edit-project-name"
              >
                <span>Project name</span>
                <Input
                  defaultValue={project.name}
                  id="edit-project-name"
                  name="name"
                  required
                />
              </label>
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="edit-client-name"
              >
                <span>Client name</span>
                <Input
                  defaultValue={project.clientName}
                  id="edit-client-name"
                  name="clientName"
                  required
                />
              </label>
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="edit-project-address"
              >
                <span>Address</span>
                <Input
                  defaultValue={project.address}
                  id="edit-project-address"
                  name="address"
                />
              </label>
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="edit-project-budget"
              >
                <span>Budget</span>
                <Input
                  defaultValue={project.budget}
                  id="edit-project-budget"
                  min="0"
                  name="budget"
                  step="1"
                  type="number"
                />
              </label>
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="edit-project-phase"
              >
                <span>Phase</span>
                <select
                  id="edit-project-phase"
                  className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm outline-none focus:border-[var(--accent)]"
                  defaultValue={project.phase ?? "Design"}
                  name="phase"
                >
                  <option>Lead</option>
                  <option>Design</option>
                  <option>Procurement</option>
                  <option>Install</option>
                  <option>Complete</option>
                </select>
              </label>
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="edit-project-status"
              >
                <span>Status</span>
                <select
                  id="edit-project-status"
                  className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm outline-none focus:border-[var(--accent)]"
                  defaultValue={project.status ?? "Active"}
                  name="status"
                >
                  <option>Active</option>
                  <option>Paused</option>
                  <option>Archived</option>
                </select>
              </label>
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="edit-project-context"
              >
                <span>Context notes</span>
                <Textarea
                  defaultValue={project.contextNotes}
                  id="edit-project-context"
                  name="contextNotes"
                />
              </label>
              <Button type="submit" variant="secondary">
                Save context
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Review queue</CardTitle>
              <CardDescription>
                Active extracted items waiting for review or sync.
              </CardDescription>
            </div>
            <form action={bulkAcceptProjectItemsAction}>
              <input type="hidden" name="projectId" value={project.recordId} />
              <Button type="submit" variant="secondary">
                Bulk accept ≥ 0.8 confidence
              </Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeItems.length === 0 ? (
              <div className="rounded-3xl bg-white/70 px-5 py-10 text-center text-sm text-[var(--foreground-soft)]">
                No active items. Generate more activity in the Linq sandbox or
                confirm a digest sync to clear out completed work.
              </div>
            ) : null}

            {activeItems.map((item) => (
              <div
                key={item.recordId}
                className="rounded-[28px] border border-[var(--border)] bg-white/80 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="accent">{item.type}</Badge>
                      <Badge tone={getConfidenceTone(item.confidence)}>
                        {Math.round(item.confidence * 100)}% confidence
                      </Badge>
                      <Badge>{item.status}</Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{item.summary}</h3>
                    <p className="text-sm text-[var(--foreground-soft)]">
                      Owner: {item.owner} • Due: {formatDate(item.due)}
                    </p>
                    {item.details ? (
                      <p className="text-sm leading-6 text-[var(--foreground-soft)]">
                        {item.details}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={acceptItemAction}>
                      <input
                        type="hidden"
                        name="itemId"
                        value={item.recordId}
                      />
                      <input
                        type="hidden"
                        name="projectId"
                        value={project.recordId}
                      />
                      <Button type="submit" variant="secondary">
                        Accept
                      </Button>
                    </form>
                    <form action={rejectItemAction}>
                      <input
                        type="hidden"
                        name="itemId"
                        value={item.recordId}
                      />
                      <input
                        type="hidden"
                        name="projectId"
                        value={project.recordId}
                      />
                      <Button type="submit" variant="outline">
                        Reject
                      </Button>
                    </form>
                  </div>
                </div>

                <details className="mt-4 rounded-3xl bg-[var(--background-soft)] px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Edit item and source message
                  </summary>
                  <div className="mt-4 space-y-4">
                    <form
                      action={updateItemAction}
                      className="grid gap-3 md:grid-cols-2"
                    >
                      <input
                        type="hidden"
                        name="itemId"
                        value={item.recordId}
                      />
                      <input
                        type="hidden"
                        name="projectId"
                        value={project.recordId}
                      />
                      <label
                        className="space-y-2 text-sm font-medium md:col-span-2"
                        htmlFor={`item-summary-${item.recordId}`}
                      >
                        <span>Summary</span>
                        <Input
                          defaultValue={item.summary}
                          id={`item-summary-${item.recordId}`}
                          name="summary"
                          required
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        <span>Type</span>
                        <select
                          className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm outline-none focus:border-[var(--accent)]"
                          defaultValue={item.type}
                          name="type"
                        >
                          <option>Decision</option>
                          <option>Action</option>
                          <option>Budget</option>
                          <option>Schedule</option>
                          <option>Product</option>
                          <option>Address</option>
                          <option>Question</option>
                          <option>Other</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        <span>Owner</span>
                        <select
                          className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm outline-none focus:border-[var(--accent)]"
                          defaultValue={item.owner}
                          name="owner"
                        >
                          <option>Designer</option>
                          <option>Client</option>
                          <option>Contractor</option>
                          <option>Vendor</option>
                          <option>Unknown</option>
                        </select>
                      </label>
                      <label
                        className="space-y-2 text-sm font-medium"
                        htmlFor={`item-due-${item.recordId}`}
                      >
                        <span>Due date</span>
                        <Input
                          defaultValue={item.due}
                          id={`item-due-${item.recordId}`}
                          name="due"
                          type="date"
                        />
                      </label>
                      <label
                        className="space-y-2 text-sm font-medium md:col-span-2"
                        htmlFor={`item-details-${item.recordId}`}
                      >
                        <span>Details</span>
                        <Textarea
                          defaultValue={item.details}
                          id={`item-details-${item.recordId}`}
                          name="details"
                        />
                      </label>
                      <div className="md:col-span-2">
                        <Button type="submit">Save edits</Button>
                      </div>
                    </form>

                    {item.sourceMessage ? (
                      <div className="rounded-3xl bg-white p-4 text-sm">
                        <p className="font-semibold">
                          {item.sourceMessage.senderName ??
                            item.sourceMessage.senderHandle ??
                            "Unknown sender"}
                        </p>
                        <p className="mt-1 text-[var(--foreground-soft)]">
                          {formatDateTime(item.sourceMessage.timestamp)}
                        </p>
                        <p className="mt-3 leading-6">
                          {item.sourceMessage.body ||
                            "No text body recorded for this message."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>
                Known handles linked to this project, including auto-created
                rows from webhook traffic.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {participants.length === 0 ? (
                <p className="text-sm text-[var(--foreground-soft)]">
                  No participants linked yet.
                </p>
              ) : (
                participants.map((participant) => (
                  <div
                    key={participant.recordId}
                    className="rounded-3xl bg-white/70 px-4 py-3 text-sm"
                  >
                    <p className="font-semibold">{participant.name}</p>
                    <p className="mt-1 text-[var(--foreground-soft)]">
                      {participant.role ?? "Other"} •{" "}
                      {participant.phone ?? "No phone stored"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Digest history</CardTitle>
              <CardDescription>
                Generated markdown runs for manual paste into Programa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestDigest ? (
                <div className="rounded-3xl bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Latest digest</p>
                  <p className="mt-1 text-[var(--foreground-soft)]">
                    {formatDateTime(latestDigest.generatedAt)}
                  </p>
                  <p className="mt-1 text-[var(--foreground-soft)]">
                    {latestDigest.confirmedSyncedAt
                      ? `Synced ${formatDateTime(latestDigest.confirmedSyncedAt)}`
                      : "Awaiting sync confirmation"}
                  </p>
                  <Button asChild className="mt-4" variant="secondary">
                    <a
                      href={`/dashboard/projects/${project.recordId}/digest?run=${latestDigest.recordId}`}
                    >
                      Open digest
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-[var(--foreground-soft)]">
                  No digest runs yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
