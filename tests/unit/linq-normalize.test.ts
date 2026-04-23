import { describe, expect, it } from "vitest";
import { normalizeMessageReceived } from "@/lib/linq";

describe("normalizeMessageReceived", () => {
  it("maps a 2026-02-03 message.received payload into the internal message shape", () => {
    const normalized = normalizeMessageReceived({
      api_version: "v3",
      webhook_version: "2026-02-03",
      event_type: "message.received",
      event_id: "evt_123",
      created_at: "2026-04-21T12:00:00.000Z",
      data: {
        direction: "inbound",
        sender_handle: {
          handle: "+15550000002",
          name: "Client",
          is_me: false,
        },
        chat: {
          id: "chat_123",
          is_group: true,
        },
        id: "msg_123",
        parts: [{ type: "text", value: "Approved the sofa." }],
        attachments: [],
        sent_at: "2026-04-21T12:00:00.000Z",
      },
    });

    expect(normalized.chatId).toBe("chat_123");
    expect(normalized.messageId).toBe("msg_123");
    expect(normalized.body).toBe("Approved the sofa.");
    expect(normalized.direction).toBe("inbound");
  });
});
