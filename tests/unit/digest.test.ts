import { describe, expect, it } from "vitest";
import { buildDigestMarkdown } from "@/lib/digest";

describe("buildDigestMarkdown", () => {
  it("groups digest items by type and preserves useful metadata", () => {
    const markdown = buildDigestMarkdown(
      {
        recordId: "rec_project",
        name: "Smith Residence",
        clientRecordIds: [],
        linqChatIds: [],
      },
      [
        {
          recordId: "rec_item_1",
          summary: "Client approved the Baxter sofa in emerald velvet.",
          projectRecordId: "rec_project",
          sourceMessageRecordId: "rec_message_1",
          type: "Decision",
          confidence: 0.92,
          status: "Accepted",
          owner: "Client",
          sourceMessage: {
            recordId: "rec_message_1",
            linqMessageId: "msg_1",
            chatId: "chat_1",
            direction: "inbound",
            body: "Approved the Baxter sofa.",
            rawParts: [],
            rawAttachments: [],
            isGroup: true,
            timestamp: "2026-04-21T12:00:00.000Z",
            processed: true,
          },
        },
        {
          recordId: "rec_item_2",
          summary: "Install moved to Friday at 10am.",
          projectRecordId: "rec_project",
          sourceMessageRecordId: "rec_message_2",
          type: "Schedule",
          confidence: 0.88,
          status: "Edited",
          owner: "Unknown",
          due: "2026-04-25",
        },
      ],
    );

    expect(markdown).toContain("## Project update — Smith Residence");
    expect(markdown).toContain("### Decisions");
    expect(markdown).toContain("### Schedules");
    expect(markdown).toContain("Client approved the Baxter sofa");
    expect(markdown).toContain("Install moved to Friday");
  });
});
