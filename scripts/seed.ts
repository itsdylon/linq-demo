import { getAirtableStore } from "../lib/airtable";
import type { ItemDraft, ProjectRecord } from "../lib/domain";

const store = getAirtableStore();

async function ensureProject(input: {
  name: string;
  clientName: string;
  chatId: string;
  address: string;
  budget: number;
  phase: string;
  contextNotes: string;
}) {
  const existing = (await store.listProjects()).find(
    (project) => project.name === input.name,
  );

  if (existing) {
    if (!existing.linqChatIds.includes(input.chatId)) {
      await store.bindChatToProject(existing.recordId, input.chatId);
    }
    return existing;
  }

  return store.createProject({
    name: input.name,
    clientName: input.clientName,
    address: input.address,
    budget: input.budget,
    phase: input.phase,
    contextNotes: input.contextNotes,
    linqChatIds: [input.chatId],
  });
}

async function seedMessage(input: {
  project: ProjectRecord;
  chatId: string;
  messageId: string;
  senderName: string;
  senderHandle: string;
  body: string;
  timestamp: string;
  items: Array<ItemDraft & { seedStatus?: "Pending" | "Accepted" | "Edited" }>;
}) {
  const { message } = await store.upsertMessageFromEvent({
    webhookEventId: `seed-event-${input.messageId}`,
    chatId: input.chatId,
    messageId: input.messageId,
    direction: "inbound",
    senderHandle: input.senderHandle,
    senderName: input.senderName,
    senderIsMe: false,
    body: input.body,
    rawParts: [{ type: "text", value: input.body }],
    rawAttachments: [],
    service: "iMessage",
    isGroup: true,
    timestamp: input.timestamp,
  });

  await store.replaceItemsForMessage(
    message.recordId,
    input.items.map(({ seedStatus: _seedStatus, ...item }) => item),
  );
  await store.markMessageProcessed(message.recordId, { processed: true });

  const projectItems = await store.listProjectItems(input.project.recordId);
  const relevantItems = projectItems.filter(
    (item) => item.sourceMessageRecordId === message.recordId,
  );

  for (const draft of input.items) {
    if (!draft.seedStatus || draft.seedStatus === "Pending") {
      continue;
    }

    const match = relevantItems.find((item) => item.summary === draft.summary);
    if (match) {
      await store.updateItem(match.recordId, { status: draft.seedStatus });
    }
  }
}

async function main() {
  const smith = await ensureProject({
    name: "Smith Residence",
    clientName: "Catherine Smith",
    chatId: "seed-chat-smith",
    address: "14 Orchard Lane",
    budget: 185000,
    phase: "Design",
    contextNotes:
      "Primary living room and dining scope. Client likes warm greens, brass, and layered neutrals.",
  });

  const chen = await ensureProject({
    name: "Chen Loft",
    clientName: "Lena Chen",
    chatId: "seed-chat-chen",
    address: "41 Mercer Street",
    budget: 98000,
    phase: "Procurement",
    contextNotes:
      "Open-plan loft install. Track lighting, custom banquette, and millwork coordination are active topics.",
  });

  await seedMessage({
    project: smith,
    chatId: "seed-chat-smith",
    messageId: "seed-smith-001",
    senderName: "Catherine Smith",
    senderHandle: "+15550000002",
    body: "Approved the Baxter sofa in emerald velvet. Also let's move install to Friday at 10.",
    timestamp: "2026-04-21T12:00:00.000Z",
    items: [
      {
        summary: "Client approved the Baxter sofa in emerald velvet.",
        type: "Decision",
        confidence: 0.95,
        owner: "Client",
        seedStatus: "Accepted",
      },
      {
        summary: "Install moved to Friday at 10am.",
        type: "Schedule",
        confidence: 0.9,
        owner: "Unknown",
        seedStatus: "Accepted",
      },
    ],
  });

  await seedMessage({
    project: smith,
    chatId: "seed-chat-smith",
    messageId: "seed-smith-002",
    senderName: "Catherine Smith",
    senderHandle: "+15550000002",
    body: "Can you send pricing on the two lamp options by Friday?",
    timestamp: "2026-04-21T12:08:00.000Z",
    items: [
      {
        summary: "Client asked for pricing on the two lamp options by Friday.",
        type: "Question",
        confidence: 0.88,
        owner: "Designer",
        due: "2026-04-24",
      },
    ],
  });

  await seedMessage({
    project: chen,
    chatId: "seed-chat-chen",
    messageId: "seed-chen-001",
    senderName: "Lena Chen",
    senderHandle: "+15550000012",
    body: "Please book the electrician for next Tuesday afternoon and keep the nursery palette warmer.",
    timestamp: "2026-04-21T12:15:00.000Z",
    items: [
      {
        summary: "Electrician should be booked for next Tuesday afternoon.",
        type: "Action",
        confidence: 0.87,
        owner: "Designer",
        due: "2026-04-28",
        seedStatus: "Edited",
      },
      {
        summary: "Client wants the nursery palette to stay warmer.",
        type: "Decision",
        confidence: 0.82,
        owner: "Client",
      },
    ],
  });

  console.log("Seeded demo projects, messages, and review items.");
}

main().catch((error) => {
  console.error("Seed failed.", error);
  process.exitCode = 1;
});
