export const APP_NAME = "Thread";
export const LINQ_WEBHOOK_VERSION = "2026-02-03";
export const LINQ_SUBSCRIBED_EVENTS = [
  "message.received",
  "reaction.added",
  "reaction.removed",
  "participant.added",
  "participant.removed",
  "chat.created",
] as const;

export const PROJECT_PHASES = [
  "Lead",
  "Design",
  "Procurement",
  "Install",
  "Complete",
] as const;

export const PROJECT_STATUSES = ["Active", "Paused", "Archived"] as const;
export const PARTICIPANT_ROLES = [
  "Client",
  "Designer",
  "Contractor",
  "Vendor",
  "Other",
] as const;
export const ITEM_TYPES = [
  "Decision",
  "Action",
  "Budget",
  "Schedule",
  "Product",
  "Address",
  "Question",
  "Other",
] as const;
export const ITEM_STATUSES = [
  "Pending",
  "Accepted",
  "Edited",
  "Rejected",
  "Synced",
] as const;
export const ITEM_OWNERS = [
  "Designer",
  "Client",
  "Contractor",
  "Vendor",
  "Unknown",
] as const;
export const EVENT_STATUSES = [
  "Pending",
  "Processed",
  "Skipped",
  "Duplicate",
  "Failed",
] as const;

export const AIRTABLE_TABLES = {
  projects: "Projects",
  participants: "Participants",
  messages: "Messages",
  items: "Items",
  digestRuns: "DigestRuns",
  events: "Events",
} as const;

export const AIRTABLE_FIELDS = {
  projects: {
    name: "Name",
    clientName: "Client Name",
    client: "Client",
    address: "Address",
    budget: "Budget",
    phase: "Phase",
    linqChatIds: "Linq Chat IDs",
    contextNotes: "Context Notes",
    status: "Status",
    lastActivity: "Last Activity",
  },
  participants: {
    name: "Name",
    phone: "Phone",
    role: "Role",
    projects: "Projects",
    notes: "Notes",
  },
  messages: {
    linqMessageId: "Linq Message ID",
    chatId: "Chat ID",
    project: "Project",
    senderHandle: "Sender Handle",
    senderName: "Sender Name",
    direction: "Direction",
    body: "Body",
    rawParts: "Raw Parts",
    rawAttachments: "Raw Attachments",
    replyToMessageId: "Reply To Message ID",
    service: "Service",
    isGroup: "Is Group",
    timestamp: "Timestamp",
    processed: "Processed",
    extractionError: "Extraction Error",
    webhookEventId: "Webhook Event ID",
  },
  items: {
    summary: "Summary",
    project: "Project",
    sourceMessage: "Source Message",
    type: "Type",
    details: "Details",
    confidence: "Confidence",
    status: "Status",
    owner: "Owner",
    due: "Due",
    reviewedAt: "Reviewed At",
    syncedAt: "Synced At",
  },
  digestRuns: {
    project: "Project",
    includedItems: "Included Items",
    digestMarkdown: "Digest Markdown",
    confirmedSyncedAt: "Confirmed Synced At",
    generatedAt: "Generated At",
  },
  events: {
    eventId: "Event ID",
    eventType: "Event Type",
    webhookVersion: "Webhook Version",
    messageId: "Message ID",
    chatId: "Chat ID",
    traceId: "Trace ID",
    partnerId: "Partner ID",
    status: "Status",
    processingNotes: "Processing Notes",
    payloadJson: "Payload JSON",
  },
} as const;

export const EXTRACTION_TOOL_NAME = "emit_items";
