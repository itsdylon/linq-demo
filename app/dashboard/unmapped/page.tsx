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
import { bindChatToProjectAction } from "../actions";

export const dynamic = "force-dynamic";

const store = getAirtableStore();

export default async function UnmappedChatsPage() {
  const [unmappedChats, projects] = await Promise.all([
    store.listUnmappedChats(),
    store.listProjects(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="serif text-3xl font-medium">Unmapped chats</h2>
        <p className="mt-2 text-sm text-[var(--foreground-soft)]">
          When a new `chat_id` appears, bind it to the right project here so
          future messages extract automatically.
        </p>
      </div>

      {unmappedChats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--foreground-soft)]">
            No unmapped chats right now. New Linq group threads will appear
            here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {unmappedChats.map((chat) => (
            <Card key={chat.chatId}>
              <CardHeader>
                <CardTitle className="text-xl">{chat.chatId}</CardTitle>
                <CardDescription>
                  {chat.messageCount} stored messages • last activity{" "}
                  {formatDateTime(chat.lastMessageAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl bg-white/70 p-4 text-sm text-[var(--foreground-soft)]">
                  <p className="font-medium text-[var(--foreground)]">
                    {chat.latestSenderName ?? "Unknown sender"}
                  </p>
                  <p className="mt-2 leading-6">
                    {chat.latestMessageBody ||
                      "No text body stored for the latest message."}
                  </p>
                </div>

                <form
                  action={bindChatToProjectAction}
                  className="flex flex-col gap-3 md:flex-row"
                >
                  <input type="hidden" name="chatId" value={chat.chatId} />
                  <select
                    className="h-11 flex-1 rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm outline-none focus:border-[var(--accent)]"
                    defaultValue=""
                    name="projectId"
                    required
                  >
                    <option disabled value="">
                      Select project
                    </option>
                    {projects.map((project) => (
                      <option key={project.recordId} value={project.recordId}>
                        {project.name} —{" "}
                        {project.clientName ?? "Unknown client"}
                      </option>
                    ))}
                  </select>
                  <Button type="submit">Bind chat</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
