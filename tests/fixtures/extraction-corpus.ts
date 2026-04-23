import type { ItemType, ParticipantRole } from "../../lib/domain";

export type EvalMessage = {
  senderName: string;
  senderHandle: string;
  body: string;
  timestamp: string;
};

export type EvalExpectedItem = {
  type: ItemType;
  anchors: string[];
};

export type EvalCase = {
  id: string;
  name: string;
  recentMessages?: EvalMessage[];
  message: EvalMessage;
  expected: EvalExpectedItem[];
  participants?: Array<{
    name: string;
    phone: string;
    role: ParticipantRole;
  }>;
};

const defaultParticipants: EvalCase["participants"] = [
  { name: "Jen", phone: "+15550000001", role: "Designer" },
  { name: "Catherine Smith", phone: "+15550000002", role: "Client" },
  { name: "Marco", phone: "+15550000003", role: "Contractor" },
];

export const extractionCorpus: EvalCase[] = [
  {
    id: "approval-sofa",
    name: "Explicit product approval",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Approved the Baxter sofa in emerald velvet. Go ahead and order it.",
      timestamp: "2026-04-21T09:00:00.000Z",
    },
    expected: [
      { type: "Decision", anchors: ["baxter sofa", "emerald velvet"] },
    ],
  },
  {
    id: "pricing-question",
    name: "Pricing follow-up question",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Can you send pricing on the two lamp options by Friday?",
      timestamp: "2026-04-21T09:05:00.000Z",
    },
    expected: [
      { type: "Question", anchors: ["pricing", "lamp options", "friday"] },
    ],
  },
  {
    id: "schedule-move",
    name: "Direct schedule change",
    participants: defaultParticipants,
    message: {
      senderName: "Jen",
      senderHandle: "+15550000001",
      body: "Let's move Thursday's install to Friday at 10 instead.",
      timestamp: "2026-04-21T09:10:00.000Z",
    },
    expected: [{ type: "Schedule", anchors: ["friday", "10", "install"] }],
  },
  {
    id: "ottoman-add",
    name: "Adding another product",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Okay, add the ottoman too.",
      timestamp: "2026-04-21T09:15:00.000Z",
    },
    expected: [{ type: "Product", anchors: ["ottoman"] }],
  },
  {
    id: "sofa-budget",
    name: "Explicit budget tolerance",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "We're comfortable going up to 4200 for the sofa.",
      timestamp: "2026-04-21T09:20:00.000Z",
    },
    expected: [{ type: "Budget", anchors: ["4200", "sofa"] }],
  },
  {
    id: "designer-action",
    name: "Designer-owned follow-up",
    participants: defaultParticipants,
    message: {
      senderName: "Jen",
      senderHandle: "+15550000001",
      body: "I'll send the tile mockups Monday morning.",
      timestamp: "2026-04-21T09:25:00.000Z",
    },
    expected: [{ type: "Action", anchors: ["tile mockups", "monday"] }],
  },
  {
    id: "pronoun-pendant",
    name: "Pronoun resolution from context",
    participants: defaultParticipants,
    recentMessages: [
      {
        senderName: "Jen",
        senderHandle: "+15550000001",
        body: "The brass pendant by Cedar & Moss is the cleanest option for the dining room.",
        timestamp: "2026-04-21T09:30:00.000Z",
      },
    ],
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Yes, that's the one for the dining room.",
      timestamp: "2026-04-21T09:31:00.000Z",
    },
    expected: [{ type: "Decision", anchors: ["dining room"] }],
  },
  {
    id: "reverse-schedule",
    name: "Schedule reversal using context",
    participants: defaultParticipants,
    recentMessages: [
      {
        senderName: "Jen",
        senderHandle: "+15550000001",
        body: "Right now the install is on Friday at 10.",
        timestamp: "2026-04-21T09:33:00.000Z",
      },
    ],
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Actually let's keep it on Thursday, not Friday.",
      timestamp: "2026-04-21T09:34:00.000Z",
    },
    expected: [{ type: "Schedule", anchors: ["thursday"] }],
  },
  {
    id: "address-logistics",
    name: "Address and logistics detail",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "The delivery address is 14 Orchard Lane, rear entrance by the garage.",
      timestamp: "2026-04-21T09:40:00.000Z",
    },
    expected: [
      { type: "Address", anchors: ["14 orchard lane", "rear entrance"] },
    ],
  },
  {
    id: "contractor-action",
    name: "Contractor-owned action request",
    participants: defaultParticipants,
    message: {
      senderName: "Jen",
      senderHandle: "+15550000001",
      body: "Have the contractor patch the ceiling before paint starts.",
      timestamp: "2026-04-21T09:45:00.000Z",
    },
    expected: [
      { type: "Action", anchors: ["patch the ceiling", "before paint"] },
    ],
  },
  {
    id: "hold-rug-order",
    name: "Pause an order",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Please hold the rug order until I confirm with Mark.",
      timestamp: "2026-04-21T09:50:00.000Z",
    },
    expected: [{ type: "Action", anchors: ["hold", "rug order"] }],
  },
  {
    id: "double-approval",
    name: "Multiple approvals in one message",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "We approved the marble slab and the oak vanity.",
      timestamp: "2026-04-21T09:55:00.000Z",
    },
    expected: [
      { type: "Decision", anchors: ["marble slab"] },
      { type: "Decision", anchors: ["oak vanity"] },
    ],
  },
  {
    id: "cheaper-mirror",
    name: "Alternative option request",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Can we see a cheaper option for the guest bath mirror?",
      timestamp: "2026-04-21T10:00:00.000Z",
    },
    expected: [
      { type: "Question", anchors: ["cheaper option", "guest bath mirror"] },
    ],
  },
  {
    id: "drapery-fabric",
    name: "Contextual fabric decision",
    participants: defaultParticipants,
    recentMessages: [
      {
        senderName: "Jen",
        senderHandle: "+15550000001",
        body: "Sending over the fabric sample with the oatmeal ground and rust stripe.",
        timestamp: "2026-04-21T10:02:00.000Z",
      },
    ],
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Love this one, use it for the drapery.",
      timestamp: "2026-04-21T10:03:00.000Z",
    },
    expected: [{ type: "Decision", anchors: ["drapery"] }],
  },
  {
    id: "book-electrician",
    name: "Book a trade appointment",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Please book the electrician for next Tuesday afternoon.",
      timestamp: "2026-04-21T10:05:00.000Z",
    },
    expected: [
      { type: "Action", anchors: ["electrician", "tuesday afternoon"] },
    ],
  },
  {
    id: "banquette-quote",
    name: "New quote amount",
    participants: defaultParticipants,
    message: {
      senderName: "Jen",
      senderHandle: "+15550000001",
      body: "The custom banquette quote came in at $8,900.",
      timestamp: "2026-04-21T10:10:00.000Z",
    },
    expected: [{ type: "Budget", anchors: ["8,900", "banquette"] }],
  },
  {
    id: "chair-delay",
    name: "Vendor timeline slip",
    participants: defaultParticipants,
    message: {
      senderName: "Jen",
      senderHandle: "+15550000001",
      body: "Vendor says the chairs will slip to early May.",
      timestamp: "2026-04-21T10:15:00.000Z",
    },
    expected: [{ type: "Schedule", anchors: ["chairs", "early may"] }],
  },
  {
    id: "nursery-palette",
    name: "Palette direction change",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "We'll keep the nursery palette warmer and drop the cool gray.",
      timestamp: "2026-04-21T10:20:00.000Z",
    },
    expected: [
      { type: "Decision", anchors: ["nursery", "warmer", "cool gray"] },
    ],
  },
  {
    id: "sconce-confirmation",
    name: "Scope clarification question",
    participants: defaultParticipants,
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "Can you confirm whether the powder room sconces are included?",
      timestamp: "2026-04-21T10:25:00.000Z",
    },
    expected: [
      { type: "Question", anchors: ["powder room sconces", "included"] },
    ],
  },
  {
    id: "client-deposit",
    name: "Client commits to payment",
    participants: defaultParticipants,
    recentMessages: [
      {
        senderName: "Jen",
        senderHandle: "+15550000001",
        body: "We just need the fabric deposit to release the order.",
        timestamp: "2026-04-21T10:28:00.000Z",
      },
    ],
    message: {
      senderName: "Catherine Smith",
      senderHandle: "+15550000002",
      body: "I'll pay that deposit today.",
      timestamp: "2026-04-21T10:29:00.000Z",
    },
    expected: [{ type: "Action", anchors: ["deposit", "today"] }],
  },
];
