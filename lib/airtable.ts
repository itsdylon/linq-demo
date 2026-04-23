import { AIRTABLE_FIELDS, AIRTABLE_TABLES, ITEM_TYPES } from "@/lib/constants";
import { buildDigestMarkdown } from "@/lib/digest";
import type {
  DigestRunRecord,
  EventRecord,
  ItemDraft,
  ItemRecord,
  NormalizedLinqMessage,
  ParticipantRecord,
  ProjectRecord,
  ProjectStatus,
  StoredMessage,
  UnmappedChat,
} from "@/lib/domain";
import { getAirtableEnv } from "@/lib/env";
import type { ThreadDataStore } from "@/lib/processing";
import {
  joinMultilineIds,
  normalizeDateInput,
  safeJsonStringify,
  splitMultilineIds,
} from "@/lib/utils";

type AirtableRecord<
  Fields extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: string;
  createdTime: string;
  fields: Fields;
};

type AirtableListResponse<Fields extends Record<string, unknown>> = {
  records: Array<AirtableRecord<Fields>>;
  offset?: string;
};

type AirtableMutationResponse<Fields extends Record<string, unknown>> = {
  records: Array<AirtableRecord<Fields>>;
};

type RecordFields = Record<string, unknown>;

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function parseJsonField<T>(value: unknown, fallback: T) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function escapeFormulaValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function equalsFormula(field: string, value: string) {
  return `{${field}}='${escapeFormulaValue(value)}'`;
}

async function airtableRequest<T>(
  path: string,
  init?: RequestInit,
  searchParams?: URLSearchParams,
) {
  const env = getAirtableEnv();
  const url = new URL(`https://api.airtable.com/v0/${path}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_PAT}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function listAllRecords<Fields extends Record<string, unknown>>(
  table: string,
  input?: {
    filterByFormula?: string;
    maxRecords?: number;
    sort?: Array<{ field: string; direction?: "asc" | "desc" }>;
  },
) {
  const env = getAirtableEnv();
  const records: Array<AirtableRecord<Fields>> = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    if (input?.filterByFormula) {
      params.set("filterByFormula", input.filterByFormula);
    }
    if (input?.maxRecords) {
      params.set("maxRecords", String(input.maxRecords));
    }
    input?.sort?.forEach((sort, index) => {
      params.set(`sort[${index}][field]`, sort.field);
      params.set(`sort[${index}][direction]`, sort.direction ?? "asc");
    });
    if (offset) {
      params.set("offset", offset);
    }

    const response = await airtableRequest<AirtableListResponse<Fields>>(
      `${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
      { method: "GET" },
      params,
    );

    records.push(...response.records);
    offset = response.offset;
  } while (offset);

  return records;
}

async function createRecords(
  table: string,
  records: Array<{ fields: RecordFields }>,
) {
  if (records.length === 0) {
    return [];
  }

  const env = getAirtableEnv();
  const created: Array<AirtableRecord<RecordFields>> = [];

  for (let index = 0; index < records.length; index += 10) {
    const batch = records.slice(index, index + 10);
    const response = await airtableRequest<
      AirtableMutationResponse<RecordFields>
    >(`${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`, {
      method: "POST",
      body: JSON.stringify({ records: batch }),
    });
    created.push(...response.records);
  }

  return created;
}

async function updateRecords(
  table: string,
  records: Array<{ id: string; fields: RecordFields }>,
) {
  if (records.length === 0) {
    return [];
  }

  const env = getAirtableEnv();
  const updated: Array<AirtableRecord<RecordFields>> = [];

  for (let index = 0; index < records.length; index += 10) {
    const batch = records.slice(index, index + 10);
    const response = await airtableRequest<
      AirtableMutationResponse<RecordFields>
    >(`${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      body: JSON.stringify({ records: batch }),
    });
    updated.push(...response.records);
  }

  return updated;
}

async function updateRecord(
  table: string,
  recordId: string,
  fields: RecordFields,
) {
  const env = getAirtableEnv();
  return airtableRequest<AirtableRecord<RecordFields>>(
    `${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${recordId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    },
  );
}

async function deleteRecords(table: string, recordIds: string[]) {
  if (recordIds.length === 0) {
    return;
  }

  const env = getAirtableEnv();
  for (let index = 0; index < recordIds.length; index += 10) {
    const batch = recordIds.slice(index, index + 10);
    const params = new URLSearchParams();
    batch.forEach((recordId) => {
      params.append("records[]", recordId);
    });
    await airtableRequest(
      `${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
      { method: "DELETE" },
      params,
    );
  }
}

async function getBaseSchema() {
  const env = getAirtableEnv();
  return airtableRequest<{
    tables: Array<{ name: string; fields: Array<{ name: string }> }>;
  }>(`meta/bases/${env.AIRTABLE_BASE_ID}/tables`, { method: "GET" });
}

function mapProject(record: AirtableRecord<RecordFields>): ProjectRecord {
  return {
    recordId: record.id,
    name:
      getString(record.fields[AIRTABLE_FIELDS.projects.name]) ??
      "Untitled project",
    clientName: getString(record.fields[AIRTABLE_FIELDS.projects.clientName]),
    clientRecordIds: getStringArray(
      record.fields[AIRTABLE_FIELDS.projects.client],
    ),
    address: getString(record.fields[AIRTABLE_FIELDS.projects.address]),
    budget: getNumber(record.fields[AIRTABLE_FIELDS.projects.budget]),
    phase: getString(
      record.fields[AIRTABLE_FIELDS.projects.phase],
    ) as ProjectRecord["phase"],
    linqChatIds: splitMultilineIds(
      getString(record.fields[AIRTABLE_FIELDS.projects.linqChatIds]),
    ),
    contextNotes: getString(
      record.fields[AIRTABLE_FIELDS.projects.contextNotes],
    ),
    status: getString(
      record.fields[AIRTABLE_FIELDS.projects.status],
    ) as ProjectStatus,
    lastActivity: getString(
      record.fields[AIRTABLE_FIELDS.projects.lastActivity],
    ),
  };
}

function mapParticipant(
  record: AirtableRecord<RecordFields>,
): ParticipantRecord {
  return {
    recordId: record.id,
    name:
      getString(record.fields[AIRTABLE_FIELDS.participants.name]) ??
      "Unknown participant",
    phone: getString(record.fields[AIRTABLE_FIELDS.participants.phone]),
    role: getString(
      record.fields[AIRTABLE_FIELDS.participants.role],
    ) as ParticipantRecord["role"],
    projectRecordIds: getStringArray(
      record.fields[AIRTABLE_FIELDS.participants.projects],
    ),
    notes: getString(record.fields[AIRTABLE_FIELDS.participants.notes]),
  };
}

function mapMessage(record: AirtableRecord<RecordFields>): StoredMessage {
  return {
    recordId: record.id,
    linqMessageId:
      getString(record.fields[AIRTABLE_FIELDS.messages.linqMessageId]) ??
      record.id,
    chatId: getString(record.fields[AIRTABLE_FIELDS.messages.chatId]) ?? "",
    projectRecordId: getStringArray(
      record.fields[AIRTABLE_FIELDS.messages.project],
    )[0],
    senderHandle: getString(
      record.fields[AIRTABLE_FIELDS.messages.senderHandle],
    ),
    senderName: getString(record.fields[AIRTABLE_FIELDS.messages.senderName]),
    direction:
      (getString(record.fields[AIRTABLE_FIELDS.messages.direction]) as
        | "inbound"
        | "outbound") ?? "inbound",
    body: getString(record.fields[AIRTABLE_FIELDS.messages.body]) ?? "",
    rawParts: parseJsonField(
      record.fields[AIRTABLE_FIELDS.messages.rawParts],
      [],
    ),
    rawAttachments: parseJsonField(
      record.fields[AIRTABLE_FIELDS.messages.rawAttachments],
      [],
    ),
    replyToMessageId: getString(
      record.fields[AIRTABLE_FIELDS.messages.replyToMessageId],
    ),
    service: getString(record.fields[AIRTABLE_FIELDS.messages.service]),
    isGroup: getBoolean(record.fields[AIRTABLE_FIELDS.messages.isGroup]),
    timestamp:
      getString(record.fields[AIRTABLE_FIELDS.messages.timestamp]) ??
      record.createdTime,
    processed: getBoolean(record.fields[AIRTABLE_FIELDS.messages.processed]),
    extractionError: getString(
      record.fields[AIRTABLE_FIELDS.messages.extractionError],
    ),
    webhookEventId: getString(
      record.fields[AIRTABLE_FIELDS.messages.webhookEventId],
    ),
  };
}

function mapItem(record: AirtableRecord<RecordFields>): ItemRecord {
  return {
    recordId: record.id,
    summary:
      getString(record.fields[AIRTABLE_FIELDS.items.summary]) ??
      "Untitled item",
    projectRecordId:
      getStringArray(record.fields[AIRTABLE_FIELDS.items.project])[0] ?? "",
    sourceMessageRecordId:
      getStringArray(record.fields[AIRTABLE_FIELDS.items.sourceMessage])[0] ??
      "",
    type:
      (getString(
        record.fields[AIRTABLE_FIELDS.items.type],
      ) as ItemRecord["type"]) ?? ITEM_TYPES[ITEM_TYPES.length - 1],
    details: getString(record.fields[AIRTABLE_FIELDS.items.details]),
    confidence: getNumber(record.fields[AIRTABLE_FIELDS.items.confidence]) ?? 0,
    status:
      (getString(
        record.fields[AIRTABLE_FIELDS.items.status],
      ) as ItemRecord["status"]) ?? "Pending",
    owner:
      (getString(
        record.fields[AIRTABLE_FIELDS.items.owner],
      ) as ItemRecord["owner"]) ?? "Unknown",
    due: normalizeDateInput(
      getString(record.fields[AIRTABLE_FIELDS.items.due]),
    ),
    reviewedAt: getString(record.fields[AIRTABLE_FIELDS.items.reviewedAt]),
    syncedAt: getString(record.fields[AIRTABLE_FIELDS.items.syncedAt]),
  };
}

function mapDigestRun(record: AirtableRecord<RecordFields>): DigestRunRecord {
  return {
    recordId: record.id,
    projectRecordId:
      getStringArray(record.fields[AIRTABLE_FIELDS.digestRuns.project])[0] ??
      "",
    includedItemRecordIds: getStringArray(
      record.fields[AIRTABLE_FIELDS.digestRuns.includedItems],
    ),
    digestMarkdown:
      getString(record.fields[AIRTABLE_FIELDS.digestRuns.digestMarkdown]) ?? "",
    confirmedSyncedAt: getString(
      record.fields[AIRTABLE_FIELDS.digestRuns.confirmedSyncedAt],
    ),
    generatedAt:
      getString(record.fields[AIRTABLE_FIELDS.digestRuns.generatedAt]) ??
      record.createdTime,
  };
}

function mapEvent(record: AirtableRecord<RecordFields>): EventRecord {
  return {
    recordId: record.id,
    eventId:
      getString(record.fields[AIRTABLE_FIELDS.events.eventId]) ?? record.id,
    eventType:
      getString(record.fields[AIRTABLE_FIELDS.events.eventType]) ?? "unknown",
    webhookVersion:
      getString(record.fields[AIRTABLE_FIELDS.events.webhookVersion]) ??
      "unknown",
    messageId: getString(record.fields[AIRTABLE_FIELDS.events.messageId]),
    chatId: getString(record.fields[AIRTABLE_FIELDS.events.chatId]),
    traceId: getString(record.fields[AIRTABLE_FIELDS.events.traceId]),
    partnerId: getString(record.fields[AIRTABLE_FIELDS.events.partnerId]),
    status:
      (getString(
        record.fields[AIRTABLE_FIELDS.events.status],
      ) as EventRecord["status"]) ?? "Pending",
    processingNotes: getString(
      record.fields[AIRTABLE_FIELDS.events.processingNotes],
    ),
    payloadJson: getString(record.fields[AIRTABLE_FIELDS.events.payloadJson]),
  };
}

export class AirtableStore implements ThreadDataStore {
  async verifyRequiredSchema() {
    const schema = await getBaseSchema();
    const missing: string[] = [];

    const expected = {
      [AIRTABLE_TABLES.projects]: Object.values(AIRTABLE_FIELDS.projects),
      [AIRTABLE_TABLES.participants]: Object.values(
        AIRTABLE_FIELDS.participants,
      ),
      [AIRTABLE_TABLES.messages]: Object.values(AIRTABLE_FIELDS.messages),
      [AIRTABLE_TABLES.items]: Object.values(AIRTABLE_FIELDS.items),
      [AIRTABLE_TABLES.digestRuns]: Object.values(AIRTABLE_FIELDS.digestRuns),
      [AIRTABLE_TABLES.events]: Object.values(AIRTABLE_FIELDS.events),
    };

    for (const [tableName, fieldNames] of Object.entries(expected)) {
      const table = schema.tables.find((entry) => entry.name === tableName);
      if (!table) {
        missing.push(`Missing table: ${tableName}`);
        continue;
      }

      for (const fieldName of fieldNames) {
        if (!table.fields.some((field) => field.name === fieldName)) {
          missing.push(`Missing field: ${tableName}.${fieldName}`);
        }
      }
    }

    return missing;
  }

  async ensureEventReceipt(input: {
    envelope: {
      event_id: string;
      event_type: string;
      webhook_version: string;
      trace_id?: string;
      partner_id?: string;
      data?: unknown;
    };
    rawBodyText: string;
  }) {
    const existing = await this.getEventByEventId(input.envelope.event_id);
    if (existing) {
      return { created: false, recordId: existing.recordId };
    }

    const data = (input.envelope.data ?? {}) as Record<string, unknown>;
    const messageId =
      typeof data.id === "string"
        ? data.id
        : typeof data.message_id === "string"
          ? data.message_id
          : undefined;
    const chatId =
      typeof data.chat === "object" &&
      data.chat &&
      "id" in data.chat &&
      typeof data.chat.id === "string"
        ? data.chat.id
        : typeof data.chat_id === "string"
          ? data.chat_id
          : undefined;

    const [created] = await createRecords(AIRTABLE_TABLES.events, [
      {
        fields: {
          [AIRTABLE_FIELDS.events.eventId]: input.envelope.event_id,
          [AIRTABLE_FIELDS.events.eventType]: input.envelope.event_type,
          [AIRTABLE_FIELDS.events.webhookVersion]:
            input.envelope.webhook_version,
          [AIRTABLE_FIELDS.events.messageId]: messageId,
          [AIRTABLE_FIELDS.events.chatId]: chatId,
          [AIRTABLE_FIELDS.events.traceId]: input.envelope.trace_id,
          [AIRTABLE_FIELDS.events.partnerId]: input.envelope.partner_id,
          [AIRTABLE_FIELDS.events.status]: "Pending",
          [AIRTABLE_FIELDS.events.payloadJson]: input.rawBodyText,
        },
      },
    ]);

    return { created: true, recordId: created.id };
  }

  async getEventByEventId(eventId: string) {
    const [record] = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.events,
      {
        filterByFormula: equalsFormula(AIRTABLE_FIELDS.events.eventId, eventId),
        maxRecords: 1,
      },
    );
    return record ? mapEvent(record) : null;
  }

  async updateEventStatus(
    eventId: string,
    patch: { status: EventRecord["status"]; processingNotes?: string },
  ) {
    const event = await this.getEventByEventId(eventId);
    if (!event) {
      return;
    }

    await updateRecord(AIRTABLE_TABLES.events, event.recordId, {
      [AIRTABLE_FIELDS.events.status]: patch.status,
      [AIRTABLE_FIELDS.events.processingNotes]: patch.processingNotes,
    });
  }

  async listProjects() {
    const records = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.projects,
      {
        sort: [
          { field: AIRTABLE_FIELDS.projects.lastActivity, direction: "desc" },
        ],
      },
    );

    return records.map(mapProject).sort((left, right) => {
      const leftTime = left.lastActivity
        ? new Date(left.lastActivity).getTime()
        : 0;
      const rightTime = right.lastActivity
        ? new Date(right.lastActivity).getTime()
        : 0;
      return rightTime - leftTime;
    });
  }

  async getProjectById(projectRecordId: string) {
    const records = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.projects,
      {
        maxRecords: 100,
      },
    );
    return (
      records
        .map(mapProject)
        .find((project) => project.recordId === projectRecordId) ?? null
    );
  }

  async getProjectByChatId(chatId: string) {
    const projects = await this.listProjects();
    return (
      projects.find((project) => project.linqChatIds.includes(chatId)) ?? null
    );
  }

  async createProject(input: {
    name: string;
    clientName: string;
    clientPhone?: string;
    address?: string;
    budget?: number;
    phase?: string;
    contextNotes?: string;
    linqChatIds?: string[];
  }) {
    const [participant] = await createRecords(AIRTABLE_TABLES.participants, [
      {
        fields: {
          [AIRTABLE_FIELDS.participants.name]: input.clientName,
          [AIRTABLE_FIELDS.participants.phone]: input.clientPhone,
          [AIRTABLE_FIELDS.participants.role]: "Client",
        },
      },
    ]);

    const [project] = await createRecords(AIRTABLE_TABLES.projects, [
      {
        fields: {
          [AIRTABLE_FIELDS.projects.name]: input.name,
          [AIRTABLE_FIELDS.projects.clientName]: input.clientName,
          [AIRTABLE_FIELDS.projects.client]: [participant.id],
          [AIRTABLE_FIELDS.projects.address]: input.address,
          [AIRTABLE_FIELDS.projects.budget]: input.budget,
          [AIRTABLE_FIELDS.projects.phase]: input.phase,
          [AIRTABLE_FIELDS.projects.contextNotes]: input.contextNotes,
          [AIRTABLE_FIELDS.projects.status]: "Active",
          [AIRTABLE_FIELDS.projects.linqChatIds]: joinMultilineIds(
            input.linqChatIds ?? [],
          ),
        },
      },
    ]);

    await updateRecord(AIRTABLE_TABLES.participants, participant.id, {
      [AIRTABLE_FIELDS.participants.projects]: [project.id],
    });

    return mapProject(project);
  }

  async updateProject(
    projectRecordId: string,
    patch: {
      name?: string;
      clientName?: string;
      address?: string;
      budget?: number;
      phase?: string;
      contextNotes?: string;
      status?: ProjectStatus;
    },
  ) {
    const fields: RecordFields = {};
    if (patch.name) {
      fields[AIRTABLE_FIELDS.projects.name] = patch.name;
    }
    if (patch.clientName) {
      fields[AIRTABLE_FIELDS.projects.clientName] = patch.clientName;
    }
    if (patch.address !== undefined) {
      fields[AIRTABLE_FIELDS.projects.address] = patch.address;
    }
    if (patch.budget !== undefined) {
      fields[AIRTABLE_FIELDS.projects.budget] = patch.budget;
    }
    if (patch.phase) {
      fields[AIRTABLE_FIELDS.projects.phase] = patch.phase;
    }
    if (patch.contextNotes !== undefined) {
      fields[AIRTABLE_FIELDS.projects.contextNotes] = patch.contextNotes;
    }
    if (patch.status) {
      fields[AIRTABLE_FIELDS.projects.status] = patch.status;
    }
    await updateRecord(AIRTABLE_TABLES.projects, projectRecordId, fields);
  }

  async bindChatToProject(projectRecordId: string, chatId: string) {
    const project = await this.getProjectById(projectRecordId);
    if (!project) {
      throw new Error("Project not found");
    }

    const linqChatIds = joinMultilineIds([...project.linqChatIds, chatId]);
    await updateRecord(AIRTABLE_TABLES.projects, projectRecordId, {
      [AIRTABLE_FIELDS.projects.linqChatIds]: linqChatIds,
    });
  }

  async listProjectParticipants(projectRecordId: string) {
    const records = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.participants,
      {
        maxRecords: 500,
      },
    );

    return records
      .map(mapParticipant)
      .filter((participant) =>
        participant.projectRecordIds.includes(projectRecordId),
      );
  }

  async ensureParticipantForMessage(
    project: ProjectRecord,
    message: StoredMessage,
  ) {
    if (!message.senderHandle) {
      return;
    }

    const participants = await this.listProjectParticipants(project.recordId);
    if (
      participants.some(
        (participant) => participant.phone === message.senderHandle,
      )
    ) {
      return;
    }

    await createRecords(AIRTABLE_TABLES.participants, [
      {
        fields: {
          [AIRTABLE_FIELDS.participants.name]:
            message.senderName ?? message.senderHandle,
          [AIRTABLE_FIELDS.participants.phone]: message.senderHandle,
          [AIRTABLE_FIELDS.participants.role]: "Other",
          [AIRTABLE_FIELDS.participants.projects]: [project.recordId],
        },
      },
    ]);
  }

  async upsertMessageFromEvent(message: NormalizedLinqMessage) {
    const existing = await this.getMessageByLinqMessageId(message.messageId);
    const project = await this.getProjectByChatId(message.chatId);

    const fields: RecordFields = {
      [AIRTABLE_FIELDS.messages.linqMessageId]: message.messageId,
      [AIRTABLE_FIELDS.messages.chatId]: message.chatId,
      [AIRTABLE_FIELDS.messages.project]: project ? [project.recordId] : [],
      [AIRTABLE_FIELDS.messages.senderHandle]: message.senderHandle,
      [AIRTABLE_FIELDS.messages.senderName]: message.senderName,
      [AIRTABLE_FIELDS.messages.direction]: message.direction,
      [AIRTABLE_FIELDS.messages.body]: message.body,
      [AIRTABLE_FIELDS.messages.rawParts]: safeJsonStringify(message.rawParts),
      [AIRTABLE_FIELDS.messages.rawAttachments]: safeJsonStringify(
        message.rawAttachments,
      ),
      [AIRTABLE_FIELDS.messages.replyToMessageId]: message.replyToMessageId,
      [AIRTABLE_FIELDS.messages.service]: message.service,
      [AIRTABLE_FIELDS.messages.isGroup]: message.isGroup,
      [AIRTABLE_FIELDS.messages.timestamp]: message.timestamp,
      [AIRTABLE_FIELDS.messages.processed]: false,
      [AIRTABLE_FIELDS.messages.extractionError]: "",
      [AIRTABLE_FIELDS.messages.webhookEventId]: message.webhookEventId,
    };

    let recordId: string;
    if (existing) {
      await updateRecord(AIRTABLE_TABLES.messages, existing.recordId, fields);
      recordId = existing.recordId;
    } else {
      const [created] = await createRecords(AIRTABLE_TABLES.messages, [
        { fields },
      ]);
      recordId = created.id;
    }

    if (project) {
      await updateRecord(AIRTABLE_TABLES.projects, project.recordId, {
        [AIRTABLE_FIELDS.projects.lastActivity]: message.timestamp,
      });
    }

    const storedMessage = await this.getMessageByLinqMessageId(
      message.messageId,
    );
    if (!storedMessage) {
      throw new Error(`Failed to persist Linq message ${message.messageId}`);
    }

    return {
      message: storedMessage,
      project,
      recordId,
    };
  }

  async getMessageByLinqMessageId(linqMessageId: string) {
    const [record] = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.messages,
      {
        filterByFormula: equalsFormula(
          AIRTABLE_FIELDS.messages.linqMessageId,
          linqMessageId,
        ),
        maxRecords: 1,
      },
    );
    return record ? mapMessage(record) : null;
  }

  async getMessageByRecordId(recordId: string) {
    const records = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.messages,
      {
        maxRecords: 500,
      },
    );
    return (
      records
        .map(mapMessage)
        .find((message) => message.recordId === recordId) ?? null
    );
  }

  async listRecentMessages(chatId: string, limit: number) {
    const records = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.messages,
      {
        sort: [
          { field: AIRTABLE_FIELDS.messages.timestamp, direction: "desc" },
        ],
        maxRecords: 500,
      },
    );

    return records
      .map(mapMessage)
      .filter((message) => message.chatId === chatId)
      .sort(
        (left, right) =>
          new Date(left.timestamp).getTime() -
          new Date(right.timestamp).getTime(),
      )
      .slice(-limit);
  }

  async listAllItems() {
    const [itemRecords, messageRecords] = await Promise.all([
      listAllRecords<RecordFields>(AIRTABLE_TABLES.items, { maxRecords: 500 }),
      listAllRecords<RecordFields>(AIRTABLE_TABLES.messages, {
        maxRecords: 500,
      }),
    ]);

    const messagesById = new Map(
      messageRecords.map((record) => [record.id, mapMessage(record)]),
    );

    return itemRecords.map((record) => {
      const item = mapItem(record);
      return {
        ...item,
        sourceMessage: messagesById.get(item.sourceMessageRecordId),
      };
    });
  }

  async listProjectItems(projectRecordId: string) {
    const items = await this.listAllItems();
    return items
      .filter((item) => item.projectRecordId === projectRecordId)
      .sort((left, right) => {
        const leftTime = left.sourceMessage?.timestamp
          ? new Date(left.sourceMessage.timestamp).getTime()
          : 0;
        const rightTime = right.sourceMessage?.timestamp
          ? new Date(right.sourceMessage.timestamp).getTime()
          : 0;
        return rightTime - leftTime;
      });
  }

  async createItems(
    projectRecordId: string,
    sourceMessageRecordId: string,
    items: ItemDraft[],
  ) {
    await createRecords(
      AIRTABLE_TABLES.items,
      items.map((item) => ({
        fields: {
          [AIRTABLE_FIELDS.items.summary]: item.summary,
          [AIRTABLE_FIELDS.items.project]: [projectRecordId],
          [AIRTABLE_FIELDS.items.sourceMessage]: [sourceMessageRecordId],
          [AIRTABLE_FIELDS.items.type]: item.type,
          [AIRTABLE_FIELDS.items.details]: item.details,
          [AIRTABLE_FIELDS.items.confidence]: item.confidence,
          [AIRTABLE_FIELDS.items.status]: "Pending",
          [AIRTABLE_FIELDS.items.owner]: item.owner ?? "Unknown",
          [AIRTABLE_FIELDS.items.due]: item.due,
        },
      })),
    );
  }

  async markMessageProcessed(
    messageRecordId: string,
    patch: { processed: boolean; extractionError?: string },
  ) {
    await updateRecord(AIRTABLE_TABLES.messages, messageRecordId, {
      [AIRTABLE_FIELDS.messages.processed]: patch.processed,
      [AIRTABLE_FIELDS.messages.extractionError]: patch.extractionError ?? "",
    });
  }

  async updateItem(
    itemRecordId: string,
    patch: {
      summary?: string;
      type?: ItemRecord["type"];
      owner?: ItemRecord["owner"];
      due?: string;
      details?: string;
      status?: ItemRecord["status"];
    },
  ) {
    const fields: RecordFields = {
      [AIRTABLE_FIELDS.items.reviewedAt]: new Date().toISOString(),
    };

    if (patch.summary) {
      fields[AIRTABLE_FIELDS.items.summary] = patch.summary;
    }
    if (patch.type) {
      fields[AIRTABLE_FIELDS.items.type] = patch.type;
    }
    if (patch.owner) {
      fields[AIRTABLE_FIELDS.items.owner] = patch.owner;
    }
    if (patch.due !== undefined) {
      fields[AIRTABLE_FIELDS.items.due] = patch.due;
    }
    if (patch.details !== undefined) {
      fields[AIRTABLE_FIELDS.items.details] = patch.details;
    }
    if (patch.status) {
      fields[AIRTABLE_FIELDS.items.status] = patch.status;
    }

    await updateRecord(AIRTABLE_TABLES.items, itemRecordId, fields);
  }

  async bulkAcceptHighConfidence(projectRecordId: string) {
    const items = await this.listProjectItems(projectRecordId);
    const eligible = items.filter(
      (item) => item.status === "Pending" && item.confidence >= 0.8,
    );

    await updateRecords(
      AIRTABLE_TABLES.items,
      eligible.map((item) => ({
        id: item.recordId,
        fields: {
          [AIRTABLE_FIELDS.items.status]: "Accepted",
          [AIRTABLE_FIELDS.items.reviewedAt]: new Date().toISOString(),
        },
      })),
    );

    return eligible.length;
  }

  async listProjectDigestRuns(projectRecordId: string) {
    const runs = await this.listAllDigestRuns();
    return runs
      .filter((run) => run.projectRecordId === projectRecordId)
      .sort((left, right) => {
        const leftTime = left.generatedAt
          ? new Date(left.generatedAt).getTime()
          : 0;
        const rightTime = right.generatedAt
          ? new Date(right.generatedAt).getTime()
          : 0;
        return rightTime - leftTime;
      });
  }

  async getDigestRunById(digestRunRecordId: string) {
    const runs = await this.listAllDigestRuns();
    return runs.find((run) => run.recordId === digestRunRecordId) ?? null;
  }

  async listAllDigestRuns() {
    const records = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.digestRuns,
      {
        maxRecords: 500,
      },
    );
    return records.map(mapDigestRun);
  }

  async createDigestRun(projectRecordId: string) {
    const [project, items, runs] = await Promise.all([
      this.getProjectById(projectRecordId),
      this.listProjectItems(projectRecordId),
      this.listProjectDigestRuns(projectRecordId),
    ]);

    if (!project) {
      throw new Error("Project not found");
    }

    const priorItemIds = new Set(
      runs.flatMap((run) => run.includedItemRecordIds),
    );
    const digestItems = items.filter(
      (item) =>
        (item.status === "Accepted" || item.status === "Edited") &&
        !priorItemIds.has(item.recordId),
    );

    if (digestItems.length === 0) {
      return null;
    }

    const markdown = buildDigestMarkdown(project, digestItems);
    const [created] = await createRecords(AIRTABLE_TABLES.digestRuns, [
      {
        fields: {
          [AIRTABLE_FIELDS.digestRuns.project]: [projectRecordId],
          [AIRTABLE_FIELDS.digestRuns.includedItems]: digestItems.map(
            (item) => item.recordId,
          ),
          [AIRTABLE_FIELDS.digestRuns.digestMarkdown]: markdown,
        },
      },
    ]);

    return mapDigestRun(created);
  }

  async confirmDigestRunSync(digestRunRecordId: string) {
    const runs = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.digestRuns,
      {
        maxRecords: 500,
      },
    );
    const record = runs.find((run) => run.id === digestRunRecordId);
    if (!record) {
      throw new Error("Digest run not found");
    }

    const run = mapDigestRun(record);
    const timestamp = new Date().toISOString();

    await updateRecords(
      AIRTABLE_TABLES.items,
      run.includedItemRecordIds.map((itemRecordId) => ({
        id: itemRecordId,
        fields: {
          [AIRTABLE_FIELDS.items.status]: "Synced",
          [AIRTABLE_FIELDS.items.syncedAt]: timestamp,
        },
      })),
    );

    await updateRecord(AIRTABLE_TABLES.digestRuns, digestRunRecordId, {
      [AIRTABLE_FIELDS.digestRuns.confirmedSyncedAt]: timestamp,
    });

    return run;
  }

  async listUnmappedChats() {
    const records = await listAllRecords<RecordFields>(
      AIRTABLE_TABLES.messages,
      {
        sort: [
          { field: AIRTABLE_FIELDS.messages.timestamp, direction: "desc" },
        ],
        maxRecords: 500,
      },
    );

    const grouped = new Map<string, UnmappedChat>();

    for (const message of records.map(mapMessage)) {
      if (message.projectRecordId) {
        continue;
      }

      const existing = grouped.get(message.chatId);
      if (!existing) {
        grouped.set(message.chatId, {
          chatId: message.chatId,
          messageCount: 1,
          lastMessageAt: message.timestamp,
          latestMessageBody: message.body,
          latestSenderName: message.senderName ?? message.senderHandle,
        });
        continue;
      }

      existing.messageCount += 1;
    }

    return Array.from(grouped.values()).sort((left, right) => {
      const leftTime = left.lastMessageAt
        ? new Date(left.lastMessageAt).getTime()
        : 0;
      const rightTime = right.lastMessageAt
        ? new Date(right.lastMessageAt).getTime()
        : 0;
      return rightTime - leftTime;
    });
  }

  async replaceItemsForMessage(messageRecordId: string, items: ItemDraft[]) {
    const existingItems = await this.listAllItems();
    const target = existingItems.filter(
      (item) => item.sourceMessageRecordId === messageRecordId,
    );
    await deleteRecords(
      AIRTABLE_TABLES.items,
      target.map((item) => item.recordId),
    );

    const message = await this.getMessageByRecordId(messageRecordId);
    if (!message?.projectRecordId) {
      throw new Error("Message is not linked to a project");
    }

    await this.createItems(message.projectRecordId, messageRecordId, items);
  }
}

let store: AirtableStore | null = null;

export function getAirtableStore() {
  store ??= new AirtableStore();
  return store;
}
