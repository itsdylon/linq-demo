import { createHmac, timingSafeEqual } from "node:crypto";
import { LINQ_WEBHOOK_VERSION } from "@/lib/constants";
import {
  type LinqMessageReceivedEnvelope,
  type LinqWebhookEnvelope,
  linqMessageReceivedEnvelopeSchema,
  linqWebhookEnvelopeSchema,
  type NormalizedLinqMessage,
} from "@/lib/domain";

export function verifyLinqWebhookSignature(input: {
  bodyText: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: number;
}) {
  const { bodyText, signature, timestamp, secret, now = Date.now() } = input;

  if (!signature || !timestamp) {
    return false;
  }

  const ageMs = Math.abs(now - Number(timestamp) * 1000);
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
    return false;
  }

  const payload = `${timestamp}.${bodyText}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function parseLinqWebhookEnvelope(
  bodyText: string,
): LinqWebhookEnvelope {
  const json = JSON.parse(bodyText) as unknown;
  return linqWebhookEnvelopeSchema.parse(json);
}

export function parseMessageReceivedEnvelope(
  bodyText: string,
): LinqMessageReceivedEnvelope {
  const json = JSON.parse(bodyText) as unknown;
  return linqMessageReceivedEnvelopeSchema.parse(json);
}

export function isAuditOnlyEventType(eventType: string) {
  return (
    eventType === "reaction.added" ||
    eventType === "reaction.removed" ||
    eventType === "participant.added" ||
    eventType === "participant.removed" ||
    eventType === "chat.created" ||
    eventType === "message.edited"
  );
}

export function normalizeMessageReceived(
  envelope: LinqMessageReceivedEnvelope,
): NormalizedLinqMessage {
  const { data } = envelope;
  const body = data.parts
    .filter((part) => part.type === "text" && part.value)
    .map((part) => part.value?.trim())
    .filter(Boolean)
    .join("\n");

  return {
    webhookEventId: envelope.event_id,
    chatId: data.chat.id,
    messageId: data.id,
    direction: data.direction,
    senderHandle: data.sender_handle.handle,
    senderName: data.sender_handle.name,
    senderIsMe: Boolean(data.sender_handle.is_me),
    body,
    rawParts: data.parts,
    rawAttachments: data.attachments,
    replyToMessageId: data.reply_to?.message_id,
    service: data.service ?? data.preferred_service,
    isGroup: Boolean(data.chat.is_group),
    timestamp: data.sent_at,
  };
}

export function assertPinnedWebhookVersion(envelope: LinqWebhookEnvelope) {
  if (envelope.webhook_version !== LINQ_WEBHOOK_VERSION) {
    throw new Error(
      `Unsupported Linq webhook version: ${envelope.webhook_version}. Expected ${LINQ_WEBHOOK_VERSION}.`,
    );
  }
}
