import type {
  ParticipantRecord,
  ProjectRecord,
  StoredMessage,
} from "@/lib/domain";

type PromptInput = {
  message: StoredMessage;
  project: ProjectRecord;
  participants: ParticipantRecord[];
  recentMessages: StoredMessage[];
};

export function buildExtractionPrompt({
  message,
  project,
  participants,
  recentMessages,
}: PromptInput) {
  const participantBlock =
    participants.length > 0
      ? participants
          .map(
            (participant) =>
              `- ${participant.name} (${participant.role ?? "Other"})${
                participant.phone ? ` — ${participant.phone}` : ""
              }`,
          )
          .join("\n")
      : "- No known participants yet";

  const recentConversationBlock =
    recentMessages.length > 0
      ? recentMessages
          .map(
            (entry) =>
              `[${entry.timestamp}] ${entry.senderName ?? entry.senderHandle ?? "Unknown"}: ${
                entry.body || "(no text body)"
              }`,
          )
          .join("\n")
      : "- No prior messages in context";

  const system = `You are an extraction assistant for a solo interior designer.

Read one new message from an iMessage group chat and extract only the structured facts worth saving to the project record.

Rules:
- Emit zero items for greetings, acknowledgements, casual banter, filler, or redundant restatements.
- Never invent details that are not explicit in the message or recent context.
- Owner should only be set when the responsible party is clear.
- Due dates should only be set when there is an explicit time reference.
- Confidence should be highest for near-verbatim facts, medium for paraphrases, and low for anything requiring inference.
- If confidence would be below 0.4, skip the item entirely.
- Each summary must stand alone out of context and be written in one sentence.`;

  const user = `## Project
- Name: ${project.name}
- Client: ${project.clientName ?? "Unknown"}
- Address: ${project.address ?? "Unknown"}
- Budget: ${project.budget ?? "Unknown"}
- Phase: ${project.phase ?? "Unknown"}
- Context notes: ${project.contextNotes ?? "None"}

## Participants
${participantBlock}

## Recent conversation
${recentConversationBlock}

## New message
[${message.timestamp}] ${message.senderName ?? message.senderHandle ?? "Unknown"}: ${
    message.body || "(no text body)"
  }

## Additional facts
- Attachments count: ${message.rawAttachments.length}
- Replying to message ID: ${message.replyToMessageId ?? "None"}

Emit items with the tool only.`;

  return { system, user };
}
