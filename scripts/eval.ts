import type {
  ItemRecord,
  ParticipantRecord,
  ProjectRecord,
  StoredMessage,
} from "../lib/domain";
import { extractStructuredItems } from "../lib/extract";
import { chitchatCorpus } from "../tests/fixtures/chitchat-corpus";
import {
  type EvalCase,
  extractionCorpus,
} from "../tests/fixtures/extraction-corpus";

function buildProject(): ProjectRecord {
  return {
    recordId: "rec_project_eval",
    name: "Eval Project",
    clientName: "Eval Client",
    clientRecordIds: [],
    address: "14 Orchard Lane",
    budget: 120000,
    phase: "Design",
    linqChatIds: ["chat_eval"],
    contextNotes:
      "Interior design evaluation corpus used for measuring Thread extraction quality.",
    status: "Active",
  };
}

function buildParticipants(input: EvalCase): ParticipantRecord[] {
  return (
    input.participants?.map((participant, index) => ({
      recordId: `rec_participant_${index}`,
      name: participant.name,
      phone: participant.phone,
      role: participant.role,
      projectRecordIds: ["rec_project_eval"],
    })) ?? []
  );
}

function buildMessage(
  index: number,
  message: EvalCase["message"],
): StoredMessage {
  return {
    recordId: `rec_message_${index}`,
    linqMessageId: `msg_${index}`,
    chatId: "chat_eval",
    projectRecordId: "rec_project_eval",
    senderHandle: message.senderHandle,
    senderName: message.senderName,
    direction: "inbound",
    body: message.body,
    rawParts: [{ type: "text", value: message.body }],
    rawAttachments: [],
    isGroup: true,
    timestamp: message.timestamp,
    processed: false,
  };
}

function buildRecentMessages(input: EvalCase) {
  return (input.recentMessages ?? []).map((message, index) => ({
    recordId: `rec_recent_${index}`,
    linqMessageId: `recent_${index}`,
    chatId: "chat_eval",
    projectRecordId: "rec_project_eval",
    senderHandle: message.senderHandle,
    senderName: message.senderName,
    direction: "inbound" as const,
    body: message.body,
    rawParts: [{ type: "text", value: message.body }],
    rawAttachments: [],
    isGroup: true,
    timestamp: message.timestamp,
    processed: true,
  }));
}

function itemText(item: Pick<ItemRecord, "summary" | "details">) {
  return `${item.summary} ${item.details ?? ""}`.toLowerCase();
}

function matchesExpected(
  predicted: Pick<ItemRecord, "summary" | "details" | "type">,
  expected: EvalCase["expected"][number],
) {
  const haystack = itemText(predicted);
  return (
    predicted.type === expected.type &&
    expected.anchors.every((anchor) => haystack.includes(anchor.toLowerCase()))
  );
}

async function scoreCase(input: EvalCase) {
  const project = buildProject();
  const participants = buildParticipants(input);
  const message = buildMessage(999, input.message);
  const recentMessages = buildRecentMessages(input);
  const predicted = await extractStructuredItems({
    message,
    project,
    participants,
    recentMessages,
  });

  const unmatchedPredicted = [...predicted];
  let matched = 0;

  for (const expected of input.expected) {
    const index = unmatchedPredicted.findIndex((item) =>
      matchesExpected(item, expected),
    );
    if (index >= 0) {
      matched += 1;
      unmatchedPredicted.splice(index, 1);
    }
  }

  return {
    matched,
    expectedCount: input.expected.length,
    predictedCount: predicted.length,
  };
}

async function main() {
  let matched = 0;
  let expected = 0;
  let predicted = 0;

  for (const testCase of extractionCorpus) {
    const score = await scoreCase(testCase);
    matched += score.matched;
    expected += score.expectedCount;
    predicted += score.predictedCount;
  }

  const precision = predicted === 0 ? 1 : matched / predicted;
  const recall = expected === 0 ? 1 : matched / expected;

  let chitchatFalsePositives = 0;
  for (const testCase of chitchatCorpus) {
    const result = await scoreCase(testCase);
    if (result.predictedCount > 0) {
      chitchatFalsePositives += 1;
    }
  }

  console.log(`Extraction corpus size: ${extractionCorpus.length} messages`);
  console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`Recall: ${(recall * 100).toFixed(1)}%`);
  console.log(
    `Chit-chat false positive rate: ${(
      (chitchatFalsePositives / chitchatCorpus.length) * 100
    ).toFixed(1)}%`,
  );
}

main().catch((error) => {
  console.error("Evaluation failed.", error);
  process.exitCode = 1;
});
