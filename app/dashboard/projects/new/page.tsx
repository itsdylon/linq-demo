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
import { createProjectAction } from "../../actions";

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="serif text-3xl font-medium">Create a project</h2>
        <p className="mt-2 text-sm text-[var(--foreground-soft)]">
          Bootstrap the project record before binding a Linq group chat to it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project metadata</CardTitle>
          <CardDescription>
            This mirrors the operator-facing fields from the MVP spec.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createProjectAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="project-name"
            >
              <span>Project name</span>
              <Input id="project-name" name="name" required />
            </label>
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="client-name"
            >
              <span>Client name</span>
              <Input id="client-name" name="clientName" required />
            </label>
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="client-phone"
            >
              <span>Client phone</span>
              <Input
                id="client-phone"
                name="clientPhone"
                placeholder="+15555550123"
              />
            </label>
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="project-budget"
            >
              <span>Budget</span>
              <Input
                id="project-budget"
                min="0"
                name="budget"
                step="1"
                type="number"
              />
            </label>
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="project-phase"
            >
              <span>Phase</span>
              <select
                id="project-phase"
                className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm outline-none focus:border-[var(--accent)]"
                defaultValue="Design"
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
              htmlFor="project-chat-ids"
            >
              <span>Seed chat IDs</span>
              <Input
                id="project-chat-ids"
                name="linqChatIds"
                placeholder="chat_1, chat_2"
              />
            </label>
            <label
              className="space-y-2 text-sm font-medium md:col-span-2"
              htmlFor="project-address"
            >
              <span>Address</span>
              <Input id="project-address" name="address" />
            </label>
            <label
              className="space-y-2 text-sm font-medium md:col-span-2"
              htmlFor="project-context-notes"
            >
              <span>Context notes</span>
              <Textarea
                id="project-context-notes"
                name="contextNotes"
                placeholder="Important project context, scope notes, or client preferences."
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit">Create project</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
