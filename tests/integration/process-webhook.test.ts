import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EventRecord,
  ItemDraft,
  ParticipantRecord,
  ProjectRecord,
  StoredMessage,
} from "@/lib/domain";
import { processLinqEvent, type ThreadDataStore } from "@/lib/processing";

vi.mock("@/lib/extract", () => ({
  extractStructuredItems: vi.fn(),
}));

import { extractStructuredItems } from "@/lib/extract";

class FakeStore implements ThreadDataStore {
  eventUpdates: Array<{
    eventId: string;
    patch: { status: EventRecord["status"]; processingNotes?: string };
  }> = [];
  messages: StoredMessage[] = [];
  createdItems: ItemDraft[] = [];
  marked: Array<{
    messageRecordId: string;
    processed: boolean;
    extractionError?: string;
  }> = [];
  project: ProjectRecord | null = {
    recordId: "rec_project",
    name: "Smith Residence",
    clientRecordIds: [],
    linqChatIds: ["chat_1"],
  };

  async updateEventStatus(
    eventId: string,
    patch: { status: EventRecord["status"]; processingNotes?: string },
  ) {
    this.eventUpdates.push({ eventId, patch });
  }

  async upsertMessageFromEvent() {
    const message: StoredMessage = {
      recordId: "rec_message",
      linqMessageId: "msg_1",
      chatId: "chat_1",
      projectRecordId: this.project?.recordId,
      direction: "inbound",
      body: "Approved the sofa.",
      rawParts: [{ type: "text", value: "Approved the sofa." }],
      rawAttachments: [],
      isGroup: true,
      timestamp: "2026-04-21T12:00:00.000Z",
      processed: false,
      senderName: "Client",
      senderHandle: "+15550000002",
    };
    this.messages.push(message);
    return { message, project: this.project };
  }

  async ensureParticipantForMessage() {}

  async listRecentMessages() {
    return this.messages;
  }

  async listProjectParticipants(): Promise<ParticipantRecord[]> {
    return [];
  }

  async createItems(
    _projectRecordId: string,
    _sourceMessageRecordId: string,
    items: ItemDraft[],
  ) {
    this.createdItems.push(...items);
  }

  async markMessageProcessed(
    messageRecordId: string,
    patch: { processed: boolean; extractionError?: string },
  ) {
    this.marked.push({ messageRecordId, ...patch });
  }
}

describe("processLinqEvent", () => {
  beforeEach(() => {
    vi.mocked(extractStructuredItems).mockReset();
  });

  it("stores reaction events as audit-only", async () => {
    const store = new FakeStore();

    const result = await processLinqEvent(
      {
        api_version: "v3",
        webhook_version: "2026-02-03",
        event_type: "reaction.added",
        event_id: "evt_1",
        created_at: "2026-04-21T12:00:00.000Z",
        data: {},
      },
      store,
    );

    expect(result.status).toBe("skipped");
    expect(store.eventUpdates[0]?.patch.status).toBe("Skipped");
  });

  it("marks unmapped messages processed without extraction", async () => {
    const store = new FakeStore();
    store.project = null;

    const result = await processLinqEvent(
      {
        api_version: "v3",
        webhook_version: "2026-02-03",
        event_type: "message.received",
        event_id: "evt_2",
        created_at: "2026-04-21T12:00:00.000Z",
        data: {
          direction: "inbound",
          sender_handle: {
            handle: "+15550000002",
            name: "Client",
            is_me: false,
          },
          chat: { id: "chat_1", is_group: true },
          id: "msg_1",
          parts: [{ type: "text", value: "Approved the sofa." }],
          attachments: [],
          sent_at: "2026-04-21T12:00:00.000Z",
        },
      },
      store,
    );

    expect(result.status).toBe("unmapped");
    expect(store.marked).toHaveLength(1);
    expect(store.createdItems).toHaveLength(0);
  });

  it("creates items for mapped inbound messages", async () => {
    const store = new FakeStore();
    vi.mocked(extractStructuredItems).mockResolvedValue([
      {
        summary: "Client approved the sofa.",
        type: "Decision",
        owner: "Client",
        confidence: 0.95,
      },
    ]);

    const result = await processLinqEvent(
      {
        api_version: "v3",
        webhook_version: "2026-02-03",
        event_type: "message.received",
        event_id: "evt_3",
        created_at: "2026-04-21T12:00:00.000Z",
        data: {
          direction: "inbound",
          sender_handle: {
            handle: "+15550000002",
            name: "Client",
            is_me: false,
          },
          chat: { id: "chat_1", is_group: true },
          id: "msg_1",
          parts: [{ type: "text", value: "Approved the sofa." }],
          attachments: [],
          sent_at: "2026-04-21T12:00:00.000Z",
        },
      },
      store,
    );

    expect(result.status).toBe("processed");
    expect(store.createdItems).toHaveLength(1);
    expect(store.marked[0]?.processed).toBe(true);
  });
});
