import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_TOOL_NAME } from "@/lib/constants";
import {
  extractionToolPayloadSchema,
  type ItemDraft,
  itemDraftSchema,
  type ParticipantRecord,
  type ProjectRecord,
  type StoredMessage,
} from "@/lib/domain";
import { getExtractionEnv } from "@/lib/env";
import { buildExtractionPrompt } from "@/lib/prompts/extract";
import { normalizeDateInput } from "@/lib/utils";

export async function extractStructuredItems(input: {
  message: StoredMessage;
  project: ProjectRecord;
  participants: ParticipantRecord[];
  recentMessages: StoredMessage[];
}): Promise<ItemDraft[]> {
  const env = getExtractionEnv();

  if (!input.message.body.trim() && input.message.rawAttachments.length > 0) {
    return [] satisfies ItemDraft[];
  }

  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  const { system, user } = buildExtractionPrompt(input);

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1200,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: user }],
    tools: [
      {
        name: EXTRACTION_TOOL_NAME,
        description:
          "Emit zero or more structured project-memory items from the latest message.",
        input_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["summary", "type", "confidence"],
                properties: {
                  summary: { type: "string", minLength: 1, maxLength: 200 },
                  type: { enum: itemDraftSchema.shape.type.options },
                  owner: {
                    enum: [
                      "Designer",
                      "Client",
                      "Contractor",
                      "Vendor",
                      "Unknown",
                    ],
                  },
                  due: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  details: { type: "string" },
                },
              },
            },
          },
          required: ["items"],
        },
      },
    ],
    tool_choice: {
      type: "tool",
      name: EXTRACTION_TOOL_NAME,
      disable_parallel_tool_use: true,
    },
  });

  const toolBlock = response.content.find(
    (block) => block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME,
  );

  if (!toolBlock || toolBlock.type !== "tool_use") {
    return [];
  }

  const parsed = extractionToolPayloadSchema.parse(toolBlock.input);

  return parsed.items
    .map((item) => ({
      ...item,
      due: normalizeDateInput(item.due),
    }))
    .filter((item) => item.confidence >= 0.4);
}
