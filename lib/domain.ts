import { z } from "zod";
import {
  EVENT_STATUSES,
  ITEM_OWNERS,
  ITEM_STATUSES,
  ITEM_TYPES,
  PARTICIPANT_ROLES,
  PROJECT_PHASES,
  PROJECT_STATUSES,
} from "@/lib/constants";

export const projectPhaseSchema = z.enum(PROJECT_PHASES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const participantRoleSchema = z.enum(PARTICIPANT_ROLES);
export const itemTypeSchema = z.enum(ITEM_TYPES);
export const itemStatusSchema = z.enum(ITEM_STATUSES);
export const itemOwnerSchema = z.enum(ITEM_OWNERS);
export const eventStatusSchema = z.enum(EVENT_STATUSES);

export const linqHandleSchema = z
  .object({
    id: z.string().optional(),
    handle: z.string().optional(),
    name: z.string().optional(),
    service: z.string().optional(),
    status: z.string().optional(),
    joined_at: z.string().optional(),
    left_at: z.string().nullable().optional(),
    is_me: z.boolean().optional(),
  })
  .passthrough();

export const linqMessagePartSchema = z
  .object({
    type: z.string(),
    value: z.string().optional(),
  })
  .passthrough();

export const linqAttachmentSchema = z
  .object({
    id: z.string().optional(),
    filename: z.string().optional(),
    url: z.string().optional(),
    content_type: z.string().optional(),
    size_bytes: z.number().optional(),
  })
  .passthrough();

export const linqMessagePayloadSchema = z
  .object({
    direction: z.enum(["inbound", "outbound"]),
    sender_handle: linqHandleSchema,
    chat: z
      .object({
        id: z.string(),
        is_group: z.boolean().optional(),
        owner_handle: linqHandleSchema.optional(),
      })
      .passthrough(),
    id: z.string(),
    parts: z.array(linqMessagePartSchema).default([]),
    attachments: z.array(linqAttachmentSchema).default([]),
    sent_at: z.string(),
    delivered_at: z.string().nullable().optional(),
    read_at: z.string().nullable().optional(),
    service: z.string().optional(),
    preferred_service: z.string().optional(),
    reply_to: z
      .object({
        message_id: z.string(),
        part_index: z.number().int().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const linqWebhookEnvelopeSchema = z
  .object({
    api_version: z.string(),
    webhook_version: z.string(),
    event_type: z.string(),
    event_id: z.string(),
    created_at: z.string(),
    trace_id: z.string().optional(),
    partner_id: z.string().optional(),
    data: z.unknown(),
  })
  .passthrough();

export const linqMessageReceivedEnvelopeSchema =
  linqWebhookEnvelopeSchema.extend({
    event_type: z.literal("message.received"),
    data: linqMessagePayloadSchema,
  });

export const itemDraftSchema = z.object({
  summary: z.string().trim().min(1).max(200),
  type: itemTypeSchema,
  owner: itemOwnerSchema.optional().default("Unknown"),
  due: z.string().optional(),
  confidence: z.number().min(0).max(1),
  details: z.string().trim().max(4000).optional(),
});

export const extractionToolPayloadSchema = z.object({
  items: z.array(itemDraftSchema),
});

export type ProjectPhase = z.infer<typeof projectPhaseSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ParticipantRole = z.infer<typeof participantRoleSchema>;
export type ItemType = z.infer<typeof itemTypeSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type ItemOwner = z.infer<typeof itemOwnerSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type LinqHandle = z.infer<typeof linqHandleSchema>;
export type LinqMessagePart = z.infer<typeof linqMessagePartSchema>;
export type LinqAttachment = z.infer<typeof linqAttachmentSchema>;
export type LinqWebhookEnvelope = z.infer<typeof linqWebhookEnvelopeSchema>;
export type LinqMessageReceivedEnvelope = z.infer<
  typeof linqMessageReceivedEnvelopeSchema
>;
export type ItemDraft = z.infer<typeof itemDraftSchema>;

export interface ProjectRecord {
  recordId: string;
  name: string;
  clientName?: string;
  clientRecordIds: string[];
  address?: string;
  budget?: number;
  phase?: ProjectPhase;
  linqChatIds: string[];
  contextNotes?: string;
  status?: ProjectStatus;
  lastActivity?: string;
}

export interface ParticipantRecord {
  recordId: string;
  name: string;
  phone?: string;
  role?: ParticipantRole;
  projectRecordIds: string[];
  notes?: string;
}

export interface StoredMessage {
  recordId: string;
  linqMessageId: string;
  chatId: string;
  projectRecordId?: string;
  senderHandle?: string;
  senderName?: string;
  direction: "inbound" | "outbound";
  body: string;
  rawParts: LinqMessagePart[];
  rawAttachments: LinqAttachment[];
  replyToMessageId?: string;
  service?: string;
  isGroup: boolean;
  timestamp: string;
  processed: boolean;
  extractionError?: string;
  webhookEventId?: string;
}

export interface ItemRecord {
  recordId: string;
  summary: string;
  projectRecordId: string;
  sourceMessageRecordId: string;
  type: ItemType;
  details?: string;
  confidence: number;
  status: ItemStatus;
  owner: ItemOwner;
  due?: string;
  reviewedAt?: string;
  syncedAt?: string;
  sourceMessage?: StoredMessage;
}

export interface DigestRunRecord {
  recordId: string;
  projectRecordId: string;
  includedItemRecordIds: string[];
  digestMarkdown: string;
  confirmedSyncedAt?: string;
  generatedAt?: string;
}

export interface EventRecord {
  recordId: string;
  eventId: string;
  eventType: string;
  webhookVersion: string;
  messageId?: string;
  chatId?: string;
  traceId?: string;
  partnerId?: string;
  status: EventStatus;
  processingNotes?: string;
  payloadJson?: string;
}

export interface UnmappedChat {
  chatId: string;
  messageCount: number;
  lastMessageAt?: string;
  latestMessageBody?: string;
  latestSenderName?: string;
}

export interface NormalizedLinqMessage {
  webhookEventId: string;
  chatId: string;
  messageId: string;
  direction: "inbound" | "outbound";
  senderHandle?: string;
  senderName?: string;
  senderIsMe: boolean;
  body: string;
  rawParts: LinqMessagePart[];
  rawAttachments: LinqAttachment[];
  replyToMessageId?: string;
  service?: string;
  isGroup: boolean;
  timestamp: string;
}
