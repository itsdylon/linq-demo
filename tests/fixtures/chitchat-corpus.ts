import type { EvalCase } from "./extraction-corpus";

export const chitchatCorpus: EvalCase[] = [
  {
    id: "thanks",
    name: "Simple thanks",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Thanks!",
      timestamp: "2026-04-21T11:00:00.000Z",
    },
    expected: [],
  },
  {
    id: "sounds-good",
    name: "Acknowledgement",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Sounds good.",
      timestamp: "2026-04-21T11:01:00.000Z",
    },
    expected: [],
  },
  {
    id: "thumbs-up",
    name: "Emoji only",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "👍",
      timestamp: "2026-04-21T11:02:00.000Z",
    },
    expected: [],
  },
  {
    id: "perfect",
    name: "Short approval filler",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Perfect",
      timestamp: "2026-04-21T11:03:00.000Z",
    },
    expected: [],
  },
  {
    id: "ok",
    name: "Okay",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Ok",
      timestamp: "2026-04-21T11:04:00.000Z",
    },
    expected: [],
  },
  {
    id: "great-thanks",
    name: "Great thanks",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Great, thank you",
      timestamp: "2026-04-21T11:05:00.000Z",
    },
    expected: [],
  },
  {
    id: "morning",
    name: "Greeting",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Good morning!",
      timestamp: "2026-04-21T11:06:00.000Z",
    },
    expected: [],
  },
  {
    id: "typing-filler",
    name: "Filler only",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "haha yes",
      timestamp: "2026-04-21T11:07:00.000Z",
    },
    expected: [],
  },
  {
    id: "noted",
    name: "Noted",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Noted",
      timestamp: "2026-04-21T11:08:00.000Z",
    },
    expected: [],
  },
  {
    id: "talk-soon",
    name: "Closing sentiment",
    message: {
      senderName: "Client",
      senderHandle: "+15550000002",
      body: "Talk soon",
      timestamp: "2026-04-21T11:09:00.000Z",
    },
    expected: [],
  },
];
