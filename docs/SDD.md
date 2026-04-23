# Software Design Document — Thread

**Version:** 0.1 (MVP)
**Date:** 2026-04-21
**Owner:** Dylon
**Status:** Draft — pre-build
**Related:** `PRD.md`, `SRS.md`, `TECH_STACK.md`

---

## 1. Introduction

### 1.1 Purpose

This document describes the software design of Thread's MVP. It translates the requirements in `SRS.md` into architecture, components, data models, control flow, and interface contracts. It is the primary reference for implementation and should be read alongside `TECH_STACK.md` for stack-specific rationale.

### 1.2 Design goals (in priority order)

1. **Shippable in ~5 working days by one developer.** Every design choice optimizes for time-to-demo over elegance.
2. **Minimal moving parts.** Each additional service is a failure mode and a setup cost.
3. **Reviewable by default.** The operator is always in the loop; automation is suggestion, not action.
4. **Replaceable pieces.** The extraction prompt, the LLM provider, the persistence layer, and the messaging provider should each be swappable without rewriting the other three.

### 1.3 Non-goals

- Horizontal scale. Single-user, single-operator system.
- Clever abstractions. Boring code that maps 1:1 to the requirements.
- Zero-downtime deploys, HA, failover. It's a demo.

## 2. System overview

Thread is a single Next.js application deployed to Vercel. It serves three roles from one codebase: a webhook receiver for Linq, an extraction worker that calls Claude, and a review dashboard for the operator. Airtable is the single persistence layer and doubles as a data-admin UI fallback.

```
                                   ┌──────────────────┐
 iMessage group chat ──────────────▶  Linq Blue API   │
 (mom + clients +                  │                  │
  Linq number)                     │  webhook event   │
                                   └────────┬─────────┘
                                            │ POST (HMAC-signed)
                                            ▼
                               ┌──────────────────────────┐
                               │  Next.js on Vercel       │
                               │  ┌────────────────────┐  │
                               │  │ /api/linq/webhook  │  │──┐
                               │  └────────────────────┘  │  │
                               │  ┌────────────────────┐  │  │ extract
                               │  │ lib/extract.ts     │◀─┼──┘
                               │  │  (Claude tool use) │  │
                               │  └─────────┬──────────┘  │
                               │            │             │
                               │  ┌─────────▼──────────┐  │
                               │  │ lib/airtable.ts    │  │
                               │  └─────────┬──────────┘  │
                               │            │             │
                               │  ┌─────────▼──────────┐  │
                               │  │ /dashboard/*       │  │
                               │  │  (server comps +   │  │
                               │  │   server actions)  │  │
                               │  └────────────────────┘  │
                               └────────────┬─────────────┘
                                            │
                                            ▼
                               ┌──────────────────────────┐
                               │  Airtable base "Thread"  │
                               │  Projects, Participants, │
                               │  Messages, Items,        │
                               │  DigestRuns              │
                               └──────────────────────────┘
                                            │
                                  ┌─────────┴──────────┐
                                  ▼                    ▼
                           Anthropic API          (operator reads
                           (Claude Sonnet 4.6)    / writes via
                                                   browser)
```

## 3. Architecture

### 3.1 Architectural style

Event-driven serverless monolith. One deployable unit, driven by inbound webhooks and user-initiated HTTP requests. No long-running processes, no queues, no background workers. Extraction runs synchronously inside the webhook handler.

### 3.2 Why no queue?

Extraction calls average 2–5 seconds. MVP volume is <500 messages/day — peak bursts under 10 messages per minute. Vercel's function timeout (10s Hobby, 60s Pro) comfortably absorbs synchronous extraction. A queue would add: a second service, signing/delivery semantics, a retry-and-dedupe story, and ~2 days of implementation. Deferred to v2 if volume demands it.

### 3.3 Why Airtable as the only store?

Airtable is simultaneously the operational DB, the admin UI, and the ops escape hatch. Any state the system cares about is inspectable and editable by the operator in 30 seconds without deploying anything. Trade-off: 5 requests/sec rate limit and 100ms-ish round-trip latency per call. For MVP volumes both are non-issues. v2 likely graduates to Postgres + keep Airtable as an export target.

### 3.4 Deployment topology

- **Vercel** — single project, one deployment. Production branch `main`.
- **Vercel env vars** — all secrets (Linq API key, webhook secret, Anthropic key, Airtable PAT + base ID, dashboard password).
- **Airtable** — single base in a dedicated workspace. Shared with nobody.
- **Linq** — single sandbox tenant for the demo. One provisioned phone number. Webhook subscription points at the deployed Vercel URL.

### 3.5 Runtime environments

- **Development** — `pnpm dev` locally. Local Airtable base (separate from prod). A public tunnel (ngrok or Vercel preview) for Linq webhooks to reach localhost.
- **Demo / production** — Vercel main deployment. Separate Airtable base from dev.

## 4. Data model

Single Airtable base, five tables. Airtable record IDs (`rec...`) are the primary keys. Business keys (like `Linq message ID`) are indexed via formula or single-text fields enforced as unique by convention.

### 4.1 `Projects`

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line text | Primary. Human-readable. |
| `Client` | Link → Participants | Primary client. Multiple allowed but convention is one. |
| `Address` | Long text | Optional. Passed to extraction context. |
| `Budget` | Currency | Optional. Passed to extraction context. |
| `Phase` | Single select | Lead / Design / Procurement / Install / Complete |
| `Linq chat IDs` | Long text | Comma-separated. One project may bind to multiple chats over time (see §6.2 re: iMessage promotion). |
| `Context notes` | Long text | Operator-authored free-form context fed to extraction. |
| `Status` | Single select | Active / Paused / Archived |
| `Created` | Created time | Auto. |
| `Last activity` | Formula / rollup | Max of linked message timestamps. |

### 4.2 `Participants`

| Field | Type | Notes |
|---|---|---|
| `Name` | Single line text | Primary. |
| `Phone` | Phone number | E.164 format. Unique by convention. |
| `Role` | Single select | Client / Designer / Contractor / Vendor / Other |
| `Projects` | Link → Projects | Many-to-many. |
| `Notes` | Long text | Free-form. |

Self (operator) appears as a Participant with Role = Designer.

### 4.3 `Messages`

| Field | Type | Notes |
|---|---|---|
| `Linq message ID` | Single line text | Primary. Externally unique. |
| `Chat ID` | Single line text | Linq's chat ID. |
| `Project` | Link → Projects | Resolved from Chat ID at write time. Null if unmapped. |
| `Sender phone` | Phone number | E.164. |
| `Sender` | Link → Participants | Resolved by phone lookup. Null if unknown. |
| `Body` | Long text | Message body. |
| `Attachments` | Attachments | From Linq's signed attachment URLs. |
| `Timestamp` | Date/time | From Linq payload. |
| `Processed` | Checkbox | True after extraction completes (success or skip). |
| `Extraction error` | Long text | Optional. Populated on extraction failure. |
| `Received at` | Created time | Auto. Server-side receipt. |

### 4.4 `Items`

| Field | Type | Notes |
|---|---|---|
| `Summary` | Single line text | Primary. 1 sentence. |
| `Project` | Link → Projects | Required. |
| `Source message` | Link → Messages | Required. 1:1 with the message that produced it. |
| `Type` | Single select | Decision / Action / Budget / Schedule / Product / Address / Question / Other |
| `Details` | Long text | Optional structured extras (JSON-as-text is fine). |
| `Confidence` | Number | 0.00–1.00 |
| `Status` | Single select | Pending / Accepted / Edited / Rejected / Synced |
| `Owner` | Single select | Designer / Client / Contractor / Vendor / Unknown |
| `Due` | Date | Optional. |
| `Created` | Created time | Auto. |
| `Reviewed at` | Date/time | Set on Accept/Edit/Reject. |
| `Synced at` | Date/time | Set when included in a confirmed DigestRun. |

### 4.5 `DigestRuns`

| Field | Type | Notes |
|---|---|---|
| `ID` | Autonumber | Primary. |
| `Project` | Link → Projects | Required. |
| `Generated at` | Created time | Auto. |
| `Included items` | Link → Items | All items included in this digest. |
| `Digest markdown` | Long text | The rendered markdown. |
| `Confirmed synced at` | Date/time | Set when operator clicks "Mark synced." |

## 5. Component design

### 5.1 Webhook receiver — `app/api/linq/webhook/route.ts`

**Responsibility:** Accept Linq events, validate, persist raw message, dispatch to extraction, return 200.

**Control flow:**

```
POST /api/linq/webhook
 ├─ read headers: X-Linq-Signature, X-Linq-Timestamp
 ├─ read raw body
 ├─ verify HMAC(signing_secret, timestamp + body) == signature
 │    └─ mismatch → 401
 ├─ parse JSON body
 ├─ switch on event.type:
 │    ├─ "message.received" / "message.created" → handleMessage(event)
 │    ├─ "reaction.created" → log only
 │    └─ other → log, 200
 └─ 200
```

**handleMessage:**

```
handleMessage(event)
 ├─ messageId = event.data.message.id
 ├─ upsert Messages row (by Linq message ID) — idempotent
 │    └─ already-processed? → return
 ├─ resolve Project via Chat ID
 │    └─ not found → mark unmapped, return
 ├─ senderPhone == agentPhone? → mark Processed, return (REQ-F-012)
 ├─ await extract(message, project)
 │    └─ on error → update Messages.Extraction error, mark Processed=true, return
 ├─ batch-create Items in Airtable
 └─ mark Messages.Processed = true
```

**Timeouts:** Extraction has an internal 8-second Anthropic timeout. Total handler budget is 10s on Hobby. If extraction exceeds budget, we catch the timeout and log it; the webhook still returns 200.

**Idempotency:** Enforced at the Airtable layer via `performUpsert` on the `Linq message ID` field. Reprocessing a message is safe but produces duplicate Items — we avoid that by checking `Messages.Processed` before extraction and skipping if true.

### 5.2 Extraction worker — `lib/extract.ts`

**Public API:**

```ts
export async function extract(
  message: MessageRecord,
  project: ProjectRecord
): Promise<Item[]>
```

**Internal steps:**

1. Load last 20 messages for the chat (via Airtable list with filter).
2. Load participants linked to the project.
3. Construct system prompt (see §5.3).
4. Call Anthropic `messages.create` with `tools: [emitItemsTool]`, `tool_choice: {type: "tool", name: "emit_items"}`.
5. Validate tool output against schema. Reject malformed items; log count of rejected.
6. Return validated `Item[]` (may be empty).

**Determinism:** `temperature: 0.2`. We want consistent extraction, not creativity.

**Rate limiting:** None in MVP. At <500 messages/day, Anthropic rate limits are irrelevant. If we hit 429, we log and skip — a single dropped extraction is acceptable; the operator can manually replay from the Messages table in the dashboard (v2).

### 5.3 Extraction prompt — `lib/prompts/extract.ts`

A single module that exports `buildExtractionPrompt(message, project, context)`. Structure:

```
[SYSTEM]
You are an extraction assistant for a solo interior designer. You read a
single new message from one of her client group chats and extract
structured facts worth recording against the project.

## Project
- Name: {project.name}
- Client: {project.client.name}
- Address: {project.address}
- Budget: {project.budget}
- Phase: {project.phase}
- Context: {project.contextNotes}

## Participants (for pronoun resolution)
- {name} ({role}): {phone}
- ...

## Recent conversation (oldest first)
[{timestamp}] {senderName}: {body}
... (last 20)

## New message to extract from
[{timestamp}] {senderName}: {body}

## Rules
- Emit 0..N items via the `emit_items` tool. Emit nothing for chit-chat,
  greetings, acknowledgments, or content already captured by a prior
  item in the recent conversation.
- Do not invent facts. If a message references something undefined in
  context, either leave details vague or emit nothing.
- `due` is populated only for explicit dates ("by Friday", "before the
  install"). Never guess.
- `owner` is populated only when clear from phrasing.
- `confidence` reflects how much inference was needed. Verbatim ≥0.9,
  paraphrased ~0.7, inferred ~0.5. Below 0.4 → skip.
- Each item's `summary` is one past-tense sentence readable out of
  context (e.g., "Client approved emerald velvet Baxter sofa at $4,200").
```

**Tool schema:**

```ts
const emitItemsTool = {
  name: "emit_items",
  description: "Emit zero or more extracted items from the message.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["summary", "type", "confidence"],
          properties: {
            summary:    { type: "string", minLength: 1, maxLength: 200 },
            type:       { enum: ["Decision","Action","Budget","Schedule","Product","Address","Question","Other"] },
            owner:      { enum: ["Designer","Client","Contractor","Vendor","Unknown"] },
            due:        { type: "string", format: "date" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            details:    { type: "string" }
          }
        }
      }
    },
    required: ["items"]
  }
};
```

### 5.4 Airtable adapter — `lib/airtable.ts`

**Responsibilities:**
- Typed wrappers around Airtable's record operations.
- Idempotent upsert for Messages (keyed on Linq message ID).
- Batched creates for Items (up to 10 per request — Airtable's batch limit).
- Simple retry with backoff on 429.

**Exposed functions:**

```ts
getProjectByChatId(chatId: string): Promise<Project | null>
getUnmappedChats(): Promise<string[]>
listRecentMessages(chatId: string, limit: number): Promise<Message[]>
upsertMessage(m: MessageInput): Promise<Message>
createItems(projectId: string, messageId: string, items: ItemInput[]): Promise<void>
updateItem(itemId: string, patch: Partial<Item>): Promise<void>
listPendingItems(projectId: string): Promise<Item[]>
createDigestRun(projectId: string, itemIds: string[], markdown: string): Promise<DigestRun>
markItemsSynced(itemIds: string[]): Promise<void>
```

**Caching:** None in MVP. Rely on Airtable's responsiveness. If project or participant loads become hot paths, add an in-memory cache scoped to a single request.

### 5.5 Dashboard — `app/dashboard/...`

Server components throughout. Server actions for mutations — no separate REST layer needed.

Routes:

- `GET /login` — single password form.
- `POST /api/login` — set signed HTTP-only session cookie, redirect to `/dashboard`.
- `GET /dashboard` — project list (sorted by last activity).
- `GET /dashboard/projects/[id]` — project detail: metadata + pending items feed.
- `POST /dashboard/projects/[id]/items/[itemId]/accept` — server action.
- `POST /dashboard/projects/[id]/items/[itemId]/reject` — server action.
- `POST /dashboard/projects/[id]/items/[itemId]/edit` — server action with form body.
- `POST /dashboard/projects/[id]/items/bulk-accept` — server action, filters by confidence ≥0.8.
- `POST /dashboard/projects/[id]/digest` — generates DigestRun, returns markdown for display + copy.
- `POST /dashboard/projects/[id]/digest/[digestId]/confirm` — marks items Synced.
- `GET /dashboard/unmapped` — unmapped chats waiting to be bound.
- `POST /dashboard/unmapped/[chatId]/bind` — bind chat to project.
- `GET /dashboard/projects/new` + `POST` — create project.

All routes (except `/login` and `/api/linq/webhook`) require the session cookie. Middleware at `middleware.ts` enforces this.

### 5.6 Digest generator — `lib/digest.ts`

```ts
export async function generateDigest(projectId: string): Promise<DigestRun>
```

- Lists items for project with `Status in ['Accepted', 'Edited']` not already in a `DigestRun`.
- Groups by `Type`.
- Renders markdown (template in `lib/digest/template.md` or inline).
- Creates a `DigestRun` row linking to the items and storing the rendered markdown.
- Returns the run to the route handler, which renders it for the operator to copy.

Confirmation (`Mark synced`) is a separate action that sets `Items.Status = Synced` and `Items.Synced at = now` and `DigestRuns.Confirmed synced at = now`.

## 6. Key sequences

### 6.1 Happy path: message in → item visible

```
Client                    Linq                     Thread                    Airtable           Anthropic
  │  send message          │                        │                          │                    │
  │ ────────────────────▶  │                        │                          │                    │
  │                        │ webhook (signed)       │                          │                    │
  │                        │ ─────────────────────▶ │                          │                    │
  │                        │                        │ verify sig               │                    │
  │                        │                        │ upsert Messages          │                    │
  │                        │                        │ ───────────────────────▶ │                    │
  │                        │                        │                          │                    │
  │                        │                        │ load project + context   │                    │
  │                        │                        │ ───────────────────────▶ │                    │
  │                        │                        │ ◀──────────────────────  │                    │
  │                        │                        │ extract (tool use)       │                    │
  │                        │                        │ ──────────────────────────────────────────▶  │
  │                        │                        │ ◀──────────────────────────────────────────  │
  │                        │                        │ createItems (batch)      │                    │
  │                        │                        │ ───────────────────────▶ │                    │
  │                        │                        │ mark Processed           │                    │
  │                        │ 200                    │ ───────────────────────▶ │                    │
  │                        │ ◀────────────────────  │                          │                    │

Operator opens dashboard → reads Items (Status=Pending) → accepts/edits/rejects
```

### 6.2 Chat rebinding after iMessage promotion

```
1. Participant added to group → iMessage mints a new chat_id internally.
2. Next message arrives with new chat_id, unmapped.
3. Webhook handler writes Messages row with Chat ID = <new>, Project = null.
4. Dashboard /dashboard/unmapped shows the new chat with recent message preview.
5. Operator clicks "Continue as [Project]" — system appends new chat_id to
   Projects.Linq chat IDs (comma-separated list).
6. Future messages on new chat_id resolve to the existing project.
```

Heuristic we _could_ add but won't in MVP: auto-suggest the project whose participants overlap most with the new chat's participant set. v2.

### 6.3 Failure: extraction API error

```
1. Webhook arrives, message persisted.
2. Anthropic call returns 500 or times out after 8s.
3. Handler catches, writes Messages.Extraction error = "<error text>",
   Messages.Processed = true.
4. Returns 200 to Linq (no retry).
5. Dashboard project view shows a small "1 extraction failed" banner
   with a "retry" link (v2 — MVP just shows the banner, no retry action).
```

## 7. Interface contracts

### 7.1 Inbound — Linq webhook

Expected shape (inferred from public docs and reference implementations; to be verified in sandbox day 1):

```json
{
  "type": "message.received",
  "data": {
    "chat_id": "chat_xxx",
    "message": {
      "id": "msg_xxx",
      "parts": [{ "type": "text", "value": "..." }],
      "attachments": [{ "url": "...", "content_type": "image/jpeg" }],
      "created_at": "2026-04-21T14:03:11Z",
      "sender": { "handle": "+15551234567", "name": "Optional" }
    }
  }
}
```

Headers:
- `X-Linq-Timestamp: 1713708191`
- `X-Linq-Signature: sha256=<hmac hex>`

Signature: `HMAC-SHA256(signing_secret, timestamp + "." + raw_body)`.

### 7.2 Outbound — Anthropic

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: $ANTHROPIC_API_KEY
  anthropic-version: 2023-06-01
Body:
  model: "claude-sonnet-4-6"
  max_tokens: 2000
  temperature: 0.2
  system: "<composed prompt>"
  tools: [emitItemsTool]
  tool_choice: { type: "tool", name: "emit_items" }
  messages: [{ role: "user", content: "<composed prompt>" }]
```

Success → `response.content[0].input.items`.

### 7.3 Outbound — Airtable

Per-table `POST/PATCH/GET` against `https://api.airtable.com/v0/$BASE_ID/$TABLE`. Idempotent upserts via `performUpsert: true` with `fieldsToMergeOn: ["Linq message ID"]`.

## 8. Error handling strategy

Philosophy: **absorb, log, continue.** A failure to process one message must never block the next.

- **Webhook signature mismatch** → 401. Don't log body (might be an attack).
- **Malformed payload** → 200 to Linq (don't retry), log at `error` with opaque identifiers only.
- **Airtable 429** → backoff 500ms, retry once. If still failing, log and skip.
- **Airtable 5xx** → single retry, then skip. Operator can replay via dashboard in v2.
- **Anthropic timeout / 5xx** → log to `Messages.Extraction error`. No retry in MVP.
- **Anthropic malformed tool output** → drop malformed items, emit the rest. Log count.
- **Dashboard server action failure** → return error to UI, keep state unchanged.

## 9. Observability

Two surfaces:

1. **Vercel logs.** Structured JSON log lines. No PII. Every webhook, every extraction, every dashboard action emits one line.
2. **Airtable as dashboard.** Every meaningful event leaves a trail in `Messages` or `Items`. If something breaks, the operator sees it in the normal views (error banner) and the developer can reconstruct from the base.

No separate metrics store for MVP. Vercel's built-in analytics are sufficient.

## 10. Security design

(Derives from `SRS.md` §4.3.)

- Linq webhook HMAC verification is the only thing standing between public internet and our Airtable writes. Verify **before** parsing.
- Dashboard uses a signed, HTTP-only, SameSite=Strict session cookie. Password stored as a single env var (hashed? — arguably overkill for MVP single-user).
- No PII in logs. Log `chat_id`, `message_id`, and opaque project IDs only.
- Anthropic zero-retention requested at account level.
- All external calls HTTPS.
- Airtable PAT scoped to one base, read+write only on that base.

## 11. Testing strategy

MVP-appropriate, not exhaustive.

- **Unit:** extraction prompt builder, Airtable adapter transforms, HMAC verifier. Jest/Vitest.
- **Integration:** a seed script that posts fake Linq-shaped webhooks at `/api/linq/webhook` against a dev Airtable base and asserts expected Items. ~15 seeded cases.
- **Extraction eval:** a fixed corpus of 20 hand-labeled messages + expected items. Run after every prompt edit. Track precision/recall.
- **Manual:** the demo script itself is the final regression test. Rehearse once per day in the final days.

No E2E browser tests in MVP. Dashboard is small and visually verified.

## 12. Deployment and operations

### 12.1 Deployment

- Push to `main` → Vercel auto-deploys.
- Env vars managed in Vercel dashboard.
- No migrations (Airtable schema is managed via Airtable UI + a one-time setup script that verifies required fields exist).

### 12.2 Configuration

Environment variables (all required unless noted):

| Var | Purpose |
|---|---|
| `LINQ_API_KEY` | Bearer token for Linq Partner v3. |
| `LINQ_WEBHOOK_SECRET` | HMAC signing secret for webhook verification. |
| `LINQ_PHONE_NUMBER` | The provisioned Linq number in E.164, used for self-filtering. |
| `ANTHROPIC_API_KEY` | Claude key. |
| `AIRTABLE_PAT` | Personal access token scoped to the Thread base. |
| `AIRTABLE_BASE_ID` | `app...` — the base ID. |
| `DASHBOARD_PASSWORD` | Shared password for operator login. |
| `SESSION_SECRET` | Signing key for session cookies (random 32-byte hex). |

### 12.3 Operations

- Daily: check Vercel logs for error rate, check Airtable for extraction failures.
- Weekly (for real usage post-demo): review extraction quality on one project, tune prompt if drifting.
- Emergency: toggle a `PAUSED` env var that makes the webhook 200-and-ignore. Flips in 30s via Vercel env UI.

## 13. Open design questions

Intentionally few — this is MVP and opinions are made. The real open questions live in `PRD.md` §11 and are product-level, not design-level.

- **Should extraction batch multiple messages?** Per-message is simpler; windowed (debounce 10s, extract from a burst) is cleaner. Decide after M2 based on seeded corpus behavior.
- **Dashboard: custom Next.js vs Airtable Interface?** Build starts with custom; if 1 day in it's clear the custom UI isn't adding value over Airtable Interfaces, switch. Named commitment: decide at end of M3.

## 14. Glossary

See `SRS.md` §1.3. Terms are used consistently across PRD, SRS, and SDD.
