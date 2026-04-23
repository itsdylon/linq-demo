import { getAirtableStore } from "../lib/airtable";
import { extractStructuredItems } from "../lib/extract";

async function main() {
  const linqMessageId = process.argv[2];
  if (!linqMessageId) {
    throw new Error("Usage: pnpm replay <linq-message-id>");
  }

  const store = getAirtableStore();
  const message = await store.getMessageByLinqMessageId(linqMessageId);
  if (!message?.projectRecordId) {
    throw new Error(`No mapped message found for ${linqMessageId}`);
  }

  const [project, participants, recentMessages] = await Promise.all([
    store.getProjectById(message.projectRecordId),
    store.listProjectParticipants(message.projectRecordId),
    store.listRecentMessages(message.chatId, 20),
  ]);

  if (!project) {
    throw new Error(`Project ${message.projectRecordId} not found`);
  }

  const items = await extractStructuredItems({
    message,
    project,
    participants,
    recentMessages: recentMessages.filter(
      (entry) => entry.linqMessageId !== message.linqMessageId,
    ),
  });

  await store.replaceItemsForMessage(message.recordId, items);
  await store.markMessageProcessed(message.recordId, {
    processed: true,
    extractionError: "",
  });

  console.log(
    `Replayed extraction for ${linqMessageId}. Persisted ${items.length} items.`,
  );
}

main().catch((error) => {
  console.error("Replay failed.", error);
  process.exitCode = 1;
});
