# Software Requirements Specification — Thread

**Version:** 0.1 (MVP)
**Date:** 2026-04-21
**Owner:** Dylon
**Status:** Draft — pre-build
**Related:** `PRD.md`, `SDD.md`, `TECH_STACK.md`

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the MVP build of Thread, an iMessage extraction agent for solo service operators. Requirements are scoped to what must be true for the MVP to be demo-able to the Linq team and usable by a single real user (the primary persona, "Jen") on at least one live project.

### 1.2 Scope

The MVP comprises: a Linq-integrated webhook receiver, an LLM-backed extraction pipeline, an Airtable-backed persistence layer, a web-based review dashboard, and a digest generator. The system is single-tenant and runs on serverless infrastructure. CRM write-back, outbound messaging, and multi-user support are explicitly out of scope.

### 1.3 Definitions

- **Agent** — The Linq-provisioned iMessage number and the backend service that receives its webhooks.
- **Group chat** — An iMessage conversation with three or more participants, one of whom is the Agent.
- **Item** — A single structured extraction (one decision, action, schedule change, etc.) attributed to a source message.
- **Project** — A container for chats, participants, items, and digests. 1:1 with a real-world client engagement.
- **Digest** — A markdown document summarizing accepted items for a project over a time window, intended for manual paste into Programa.
- **Operator** — The primary user (Jen). Single user in MVP.

### 1.4 References

- Linq Blue API documentation — `apidocs.linqapp.com` (base `https://api.linqapp.com/api/partner/v3`)
- Anthropic Messages API — Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- Airtable Web API — `airtable.com/developers/web/api`

## 2. Overall description

### 2.1 Product perspective

Thread is a standalone system. It depends on three external services (Linq, Anthropic, Airtable) and integrates with Programa only via manual copy-paste (no machine interface). It has no upstream systems.

### 2.2 Operating environment

- Backend: Node.js 20+ on Vercel serverless.
- Persistence: Airtable base (hosted, managed).
- Frontend: Modern desktop browsers (Chrome, Safari, Firefox current versions). Not mobile-optimized.
- External services: Linq Blue API, Anthropic API, Airtable Web API.

### 2.3 Design and implementation constraints

- Must use Linq for all iMessage traffic.
- Cannot depend on any Programa API (none exists).
- Must run inside Vercel's serverless execution limits (60s function timeout on Pro, 10s on Hobby — MVP targets Hobby).
- Airtable rate limit: 5 requests/second per base. Must batch writes where possible.
- Anthropic API budget target: <$1/day at MVP usage volumes.

### 2.4 User classes

- **Operator (Jen)** — Authenticated user. Full access to dashboard and digest functions. Single user in MVP.
- **Client / Participant** — Non-users. Interact with the Agent only by being in a group chat with it. Have no awareness of the system, no account, no data-access rights in MVP.

## 3. Functional requirements

Each requirement is numbered `REQ-F-NNN`, has an acceptance criterion, and a priority (`MUST`, `SHOULD`, `MAY`).

### 3.1 Chat and project binding

**REQ-F-001 — Project creation (MUST).** The Operator shall be able to create a Project via the dashboard with fields: name (required), client name (required), address, budget, phase, free-form context notes.
_Acceptance:_ New Project appears in the dashboard within 2 seconds of submit and is queryable via the Airtable base.

**REQ-F-002 — Chat binding (MUST).** When the Agent receives its first inbound message from a previously unseen `chat_id`, the system shall store the chat as "unmapped" and surface it in the dashboard for the Operator to bind to an existing Project.
_Acceptance:_ An unmapped chat is visible in the dashboard within 5 seconds of the first inbound message. Binding persists the `chat_id → Project` association.

**REQ-F-003 — Chat rebinding (SHOULD).** When iMessage promotes a group (e.g., participant added) and a new `chat_id` is observed with an overlapping participant set, the system shall suggest binding the new chat to the existing Project.
_Acceptance:_ On participant-change-induced chat_id change, dashboard presents a one-click "continue as [Project]" prompt.

### 3.2 Message ingestion

**REQ-F-010 — Inbound webhook receipt (MUST).** The system shall expose a single webhook endpoint that receives `message.received` / `message.created` events from Linq, verifies their signature, and responds 200 within 3 seconds of receipt.
_Acceptance:_ A signed Linq webhook delivered to the endpoint results in a stored message and a 200 response. An unsigned or mis-signed request results in a 401.

**REQ-F-011 — Idempotent message storage (MUST).** The system shall store each inbound message exactly once, keyed on Linq's `message_id`. Duplicate deliveries shall be detected and discarded.
_Acceptance:_ Submitting the same webhook payload twice results in one row in `Messages`. The second call returns 200 without side effects.

**REQ-F-012 — Self-message filtering (MUST).** Messages whose sender matches the Agent's own provisioned number (echoes of outbound messages, if Linq delivers them) shall be stored but not submitted to extraction.
_Acceptance:_ A message with sender == Agent phone is persisted with `Processed = true, Extraction error = null` and produces zero `Items`.

**REQ-F-013 — Reaction / tapback filtering (SHOULD).** Webhook events representing reactions (emoji tapbacks) shall be stored for audit but not processed by extraction.
_Acceptance:_ A `reaction.created` event results in a log row but no Items.

**REQ-F-014 — Attachment capture (MUST).** Messages with attachments shall have the attachment metadata persisted and, where feasible, the attachment file stored in the corresponding Airtable `Messages.Attachments` field.
_Acceptance:_ A message with a photo attachment has the attachment visible in the dashboard message view.

### 3.3 Extraction

**REQ-F-020 — Per-message extraction (MUST).** For each eligible inbound message (not self, not reaction, bound to a Project), the system shall invoke Claude Sonnet 4.6 with a structured-output tool call returning zero or more Items.
_Acceptance:_ On a corpus of 20 hand-labeled messages, the system produces Items matching labeled extractions with ≥80% precision and ≥70% recall.

**REQ-F-021 — Extraction context window (MUST).** Extraction shall include, as model input: (a) the current message, (b) the previous 20 messages in the same chat (for pronoun resolution), (c) Project metadata including the free-form context notes, (d) Participant roles.
_Acceptance:_ Extraction on a message containing "move it to Friday" correctly resolves "it" to the subject of the prior turns.

**REQ-F-022 — Structured output shape (MUST).** Each emitted Item shall include: `summary` (1 sentence), `type` (enum: Decision, Action, Budget, Schedule, Product, Address, Question, Other), `owner` (enum: Designer, Client, Contractor, Vendor, Unknown), `due` (ISO date, optional), `confidence` (0.0–1.0), `details` (optional free-text).
_Acceptance:_ Items in Airtable conform to the schema; invalid Items from the model are rejected and logged but do not raise to the Operator.

**REQ-F-023 — Conservative extraction (MUST).** The extraction prompt shall instruct the model to emit zero Items for chit-chat, greetings, and acknowledgments. False-positive rate on a chit-chat-only corpus of 10 messages shall be ≤10%.
_Acceptance:_ Corpus of "hey / thanks / sounds good / ok / 👍 / perfect" produces 0 Items.

**REQ-F-024 — Failure handling (MUST).** Extraction failures (API error, malformed tool output, timeout) shall be caught and logged to `Messages.Extraction error`. Failures shall not propagate to Linq; the webhook shall return 200 regardless of extraction outcome.
_Acceptance:_ An induced Claude API error produces a failed-extraction row and does not cause Linq retries.

**REQ-F-025 — Latency (SHOULD).** Extraction end-to-end (webhook in → Items in Airtable) shall complete within 10 seconds for 95% of messages.
_Acceptance:_ p95 processing time across 50 test messages ≤10 seconds.

### 3.4 Review dashboard

**REQ-F-030 — Authenticated access (MUST).** The dashboard shall require a shared-password login. Unauthenticated requests to dashboard routes shall redirect to `/login`.
_Acceptance:_ Requests without a valid session cookie cannot read or write data.

**REQ-F-031 — Project list (MUST).** The dashboard shall display a list of Projects ordered by most recent activity.
_Acceptance:_ Projects appear with last-message timestamp; clicking opens the project detail view.

**REQ-F-032 — Project detail view (MUST).** The project view shall show: Project metadata, a reverse-chronological feed of non-synced Items, and a "Generate digest" button.
_Acceptance:_ Opening a project view shows all Items with status != Synced, sorted by creation time descending.

**REQ-F-033 — Item review actions (MUST).** Each Item shall support Accept, Edit, and Reject actions. Accept sets status to Accepted. Reject sets status to Rejected. Edit opens an inline form for modifying `summary`, `type`, `owner`, `due`, and `details`, then sets status to Edited.
_Acceptance:_ All three actions persist to Airtable within 1 second and update the UI without full page reload.

**REQ-F-034 — Bulk accept (SHOULD).** The dashboard shall support bulk-accepting all Items on a project with confidence ≥0.8 that are currently Pending.
_Acceptance:_ A "Bulk accept high confidence" button marks eligible Items Accepted in a single operation.

**REQ-F-035 — Source message visibility (MUST).** Each Item row shall link to or surface the source message text.
_Acceptance:_ Hovering or expanding an Item reveals the source message body and sender name.

### 3.5 Digest

**REQ-F-040 — Digest generation (MUST).** The system shall generate a markdown digest for a Project consisting of all Items with status Accepted or Edited that are not in any prior DigestRun.
_Acceptance:_ Calling "Generate digest" produces a DigestRun row containing a markdown document grouped by Item type, with each entry showing summary, owner, due (if present), and source timestamp.

**REQ-F-041 — Digest copy (MUST).** The generated digest shall be displayed in a monospace block with a one-click copy-to-clipboard action.
_Acceptance:_ Clicking copy writes the digest markdown to the clipboard.

**REQ-F-042 — Mark synced (MUST).** After generating a digest, the Operator shall be able to mark the included Items as Synced, which removes them from the active feed.
_Acceptance:_ After "Mark synced," the Items no longer appear in the default project view and are excluded from future digests.

### 3.6 Setup and configuration

**REQ-F-050 — Webhook subscription setup (MUST).** On first deploy, the system's webhook URL shall be registerable with Linq such that `message.received` events are delivered to it.
_Acceptance:_ Documented setup script or manual-step runbook results in a working webhook within 5 minutes.

**REQ-F-051 — Environment configuration (MUST).** The system shall load its configuration (API keys, base IDs, dashboard password) from environment variables. No secrets shall be committed to source control.
_Acceptance:_ Fresh clone + env vars + deploy results in a working system. No hardcoded secrets in the repo.

## 4. Non-functional requirements

### 4.1 Performance

**REQ-NF-001 — Webhook response time (MUST).** The webhook endpoint shall respond 200 to Linq within 3 seconds in 99% of cases. Extraction may take longer; it runs in the background from Linq's perspective.
_Rationale:_ Linq (like all webhook providers) will retry on slow responses. Must ack quickly.

**REQ-NF-002 — Extraction latency (SHOULD).** End-to-end processing (message in → Item visible in dashboard) shall complete within 10 seconds at p95.

**REQ-NF-003 — Dashboard load time (SHOULD).** Project detail views shall load within 2 seconds on a 10 Mbps connection.

### 4.2 Reliability

**REQ-NF-010 — Idempotency (MUST).** Repeated webhook deliveries for the same message shall not produce duplicate Items (see REQ-F-011).

**REQ-NF-011 — Failure isolation (MUST).** Extraction failures on one message shall not prevent extraction on subsequent messages.

**REQ-NF-012 — Data durability (MUST).** All Messages, Items, and DigestRuns shall be persisted to Airtable immediately. No in-memory-only state.

### 4.3 Security

**REQ-NF-020 — Webhook authentication (MUST).** All inbound webhook requests shall be verified against Linq's HMAC signature before processing.

**REQ-NF-021 — Dashboard auth (MUST).** All dashboard and API routes (except `/login` and the webhook endpoint) shall require a valid session cookie.

**REQ-NF-022 — Secrets management (MUST).** API keys (Linq, Anthropic, Airtable) and the dashboard password shall be stored only in environment variables, never in source code or logs.

**REQ-NF-023 — PII in logs (MUST).** Phone numbers, message bodies, client names, and addresses shall not appear in application logs. Log lines shall use opaque identifiers (chat_id, message_id).

**REQ-NF-024 — Transport security (MUST).** All external API calls (Linq, Anthropic, Airtable) shall use HTTPS. The dashboard shall be served over HTTPS.

**REQ-NF-025 — Zero-retention LLM (SHOULD).** Anthropic API calls shall use zero-retention mode where available for the account tier.

### 4.4 Usability

**REQ-NF-030 — Setup time (SHOULD).** A user with access to Linq credentials, an Anthropic key, and an Airtable PAT shall be able to deploy and configure a working instance in under 30 minutes following the runbook.

**REQ-NF-031 — Review friction (SHOULD).** Reviewing a day's extractions (~20 Items) shall take no more than 5 minutes of the Operator's time.

### 4.5 Maintainability

**REQ-NF-040 — Single codebase (MUST).** Backend (webhook, extraction) and frontend (dashboard) shall be in a single repository, a single deployment.

**REQ-NF-041 — Typed external interfaces (SHOULD).** All contracts with external APIs (Linq webhook payloads, Claude tool calls, Airtable records) shall have TypeScript types.

### 4.6 Observability

**REQ-NF-050 — Event audit trail (MUST).** Every inbound webhook, every extraction attempt (success or failure), and every user action on the dashboard shall be reflected in persisted state (either as a message row, an item row, or an audit log entry).

**REQ-NF-051 — Error visibility (SHOULD).** Extraction failures shall be visible on the dashboard as a small indicator on the project view, without blocking normal use.

### 4.7 Scalability

**REQ-NF-060 — MVP scale (MUST).** The system shall handle up to 10 active projects and 500 inbound messages per day without degradation. (This is 10–50× typical single-operator volume.)

**REQ-NF-061 — Beyond-MVP (NOT REQUIRED).** No scalability guarantees beyond MVP scale. Multi-tenant, high-throughput support is explicitly deferred.

## 5. External interface requirements

### 5.1 User interfaces

- Web dashboard, desktop-first.
- Login page (single password field).
- Project list view.
- Project detail view with Items feed.
- Digest generation modal.
- No mobile UI in MVP.

### 5.2 Consumed APIs

- **Linq Blue API (Partner v3)** — Base `https://api.linqapp.com/api/partner/v3`. Bearer token auth. Webhook subscriptions and outbound message sending (sending deferred to v2). HMAC signature verification on inbound webhooks.
- **Anthropic Messages API** — `claude-sonnet-4-6` model. Tool-use mode with a single `emit_items` tool.
- **Airtable Web API** — Personal Access Token auth. Record-level CRUD on the Thread base. Upsert support for idempotent writes.

### 5.3 Exposed interfaces

- `POST /api/linq/webhook` — Linq webhook receiver. Public endpoint (signature-verified).
- `GET /dashboard` — Authenticated web UI.
- `POST /api/items/:id` — Authenticated REST for item actions.
- `POST /api/projects/:id/digest` — Authenticated digest generation.

### 5.4 Data interfaces

- Airtable as single persistence store (see `SDD.md` §4 for schema).
- No direct database access. No read replicas, no caching layer.

## 6. Constraints and assumptions

### 6.1 Constraints

- Linq API must be used for all iMessage traffic.
- No Programa API exists; write-back is manual-paste only.
- Vercel Hobby tier limits: 10s function timeout, 100 GB-hrs/mo bandwidth (ample for demo).
- Single developer, ~5 working days to demo.

### 6.2 Assumptions

- Linq webhook fires on all group-chat messages (not only @-mentions) — verified.
- Linq-provisioned numbers can be added to existing iMessage group chats by end users — verified, with iMessage's chat-promotion quirk to handle.
- Claude Sonnet 4.6 extraction quality is sufficient for the target precision/recall (REQ-F-020).
- The Operator accepts that her clients are being observed by an AI. Real-world consent flow is a v2 question; MVP demo uses test phones.

## 7. Acceptance criteria (MVP gate)

The MVP is considered complete when:

1. All `MUST` functional requirements pass acceptance tests on a seeded dataset.
2. The demo script (see `spec.md` §12) runs end-to-end without intervention in under 5 minutes.
3. One real project with one real client (or equivalent) has been running for at least 48 hours with extraction quality meeting REQ-F-020.
4. The Operator has successfully generated and used at least one digest against Programa.

---

## Appendix A — Traceability matrix

| PRD User Story | SRS Requirements |
|---|---|
| US-1 (add agent to chat) | REQ-F-002, REQ-F-003 |
| US-2 (auto-associate chat) | REQ-F-002 |
| US-3 (analyze every message) | REQ-F-010, REQ-F-020, REQ-F-021, REQ-F-023 |
| US-4 (live feed per project) | REQ-F-031, REQ-F-032, REQ-F-035, REQ-NF-003 |
| US-5 (accept / edit / reject) | REQ-F-033 |
| US-6 (generate digest) | REQ-F-040, REQ-F-041, REQ-F-042 |
| US-7 (unanswered Q flags) | _deferred to v2_ |
| US-8 (bulk accept) | REQ-F-034 |
