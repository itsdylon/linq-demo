import type {
  EventRecord,
  ItemDraft,
  LinqWebhookEnvelope,
  NormalizedLinqMessage,
  ParticipantRecord,
  ProjectRecord,
  StoredMessage,
} from "@/lib/domain";
import { extractStructuredItems } from "@/lib/extract";
import {
  assertPinnedWebhookVersion,
  isAuditOnlyEventType,
  normalizeMessageReceived,
} from "@/lib/linq";

export interface ThreadDataStore {
  updateEventStatus(
    eventId: string,
    patch: { status: EventRecord["status"]; processingNotes?: string },
  ): Promise<void>;
  upsertMessageFromEvent(
    message: NormalizedLinqMessage,
  ): Promise<{ message: StoredMessage; project: ProjectRecord | null }>;
  ensureParticipantForMessage(
    project: ProjectRecord,
    message: StoredMessage,
  ): Promise<void>;
  listRecentMessages(chatId: string, limit: number): Promise<StoredMessage[]>;
  listProjectParticipants(
    projectRecordId: string,
  ): Promise<ParticipantRecord[]>;
  createItems(
    projectRecordId: string,
    sourceMessageRecordId: string,
    items: ItemDraft[],
  ): Promise<void>;
  markMessageProcessed(
    messageRecordId: string,
    patch: { processed: boolean; extractionError?: string },
  ): Promise<void>;
}

export async function processLinqEvent(
  envelope: LinqWebhookEnvelope,
  store: ThreadDataStore,
) {
  assertPinnedWebhookVersion(envelope);

  if (envelope.event_type !== "message.received") {
    const processingNotes = isAuditOnlyEventType(envelope.event_type)
      ? "Stored as audit-only event"
      : "Ignored unsupported event type";

    await store.updateEventStatus(envelope.event_id, {
      status: "Skipped",
      processingNotes,
    });

    return { status: "skipped" as const };
  }

  const normalizedMessage = normalizeMessageReceived({
    ...envelope,
    event_type: "message.received",
    data: envelope.data,
  } as never);

  const { message, project } =
    await store.upsertMessageFromEvent(normalizedMessage);

  if (
    normalizedMessage.direction !== "inbound" ||
    normalizedMessage.senderIsMe
  ) {
    await store.markMessageProcessed(message.recordId, { processed: true });
    await store.updateEventStatus(envelope.event_id, {
      status: "Skipped",
      processingNotes: "Skipped outbound or self-authored message",
    });
    return { status: "skipped" as const };
  }

  if (!project) {
    await store.markMessageProcessed(message.recordId, { processed: true });
    await store.updateEventStatus(envelope.event_id, {
      status: "Skipped",
      processingNotes: "Stored message for unmapped chat",
    });
    return { status: "unmapped" as const };
  }

  try {
    await store.ensureParticipantForMessage(project, message);
    const [recentMessages, participants] = await Promise.all([
      store.listRecentMessages(normalizedMessage.chatId, 20),
      store.listProjectParticipants(project.recordId),
    ]);

    const priorMessages = recentMessages.filter(
      (entry) => entry.linqMessageId !== normalizedMessage.messageId,
    );

    const items = await extractStructuredItems({
      message,
      project,
      participants,
      recentMessages: priorMessages.slice(-20),
    });

    if (items.length > 0) {
      await store.createItems(project.recordId, message.recordId, items);
    }

    await store.markMessageProcessed(message.recordId, {
      processed: true,
    });
    await store.updateEventStatus(envelope.event_id, {
      status: "Processed",
      processingNotes: items.length
        ? `Extracted ${items.length} items`
        : "No structured items emitted",
    });
    return { status: "processed" as const, itemCount: items.length };
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown error";
    await store.markMessageProcessed(message.recordId, {
      processed: true,
      extractionError: messageText,
    });
    await store.updateEventStatus(envelope.event_id, {
      status: "Failed",
      processingNotes: messageText,
    });
    return { status: "failed" as const, error: messageText };
  }
}
