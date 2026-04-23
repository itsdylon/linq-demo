# Spec: iMessage Context Agent for Small-Business Operators

**Working name:** _TBD_ (placeholder: "Thread")
**Author:** Dylon
**Date:** 2026-04-21
**Status:** Initial spec — MVP for Linq demo
**Infra constraint:** Must be built on Linq Blue API (iMessage)

---

## 1. TL;DR

An iMessage agent that lives silently inside a small-business operator's group chats with their clients, extracts structured updates from the conversation in real time, and maintains a clean "working memory" the operator can review and act on. The canonical use case: an interior designer whose real client conversations happen in iMessage, while her CRM (Programa) sits blind and out of date.

The MVP is not a CRM integration. It is a structured-extraction agent whose output is a small, reviewable store of project updates, action items, and decisions — explicitly designed around the constraint that most small-business CRMs do not expose write APIs. The value prop: reduce the "translation tax" between where business actually happens (messaging) and where it's supposed to be recorded.

---

## 2. Problem

Small-business operators in client-services verticals (interior designers, real-estate agents, photographers, event planners) do the majority of their client communication in iMessage. Their systems of record — whether Programa, Studio Designer, Dubsado, Follow Up Boss, or a hand-maintained Airtable — are updated, at best, in batch, at the end of the day, from memory. In practice most never get updated, and the conversation history becomes the de facto source of truth, searchable only by scrolling.

The cost is real: forgotten decisions, missed follow-ups, budget drift, duplicate questions to clients, and the end-of-week administrative burden of reconstructing what happened.

**Primary user:** Sole-proprietor or small-studio interior designer. Uses Programa for project/CRM. Has 5–15 active projects at any given time. Each project has its own iMessage group chat with the client (sometimes also the contractor, vendor, spouse).

**Primary pain:** "Everything important about my projects is in iMessage and it never makes it into Programa until I sit down on Sunday and force it to."

---

## 3. Scope — MVP

The MVP is a single-user deployment (the designer's mom, in the demo) with one or two seeded group chats. It is demo-able end-to-end in under five minutes.

**In scope:**
- Provisioning a Linq-backed iMessage number that can be added to existing group chats.
- Receiving every inbound message in allowlisted group chats via Linq webhooks.
- Per-message structured extraction with Claude, producing typed updates (decisions, action items, budget changes, scheduling, vendor/product references, addresses).
- Persisting extractions to Airtable as the "working-memory CRM," keyed by project.
- A minimal web dashboard showing, per project, a live feed of extracted updates with accept/reject/edit controls.
- An end-of-day digest the operator can copy-paste into Programa (or email to herself).
- A demo script with seeded fake conversations.

**Out of scope for MVP:**
- Writing back to Programa (no API).
- Multi-user / multi-tenant support.
- Authentication beyond a single dashboard password.
- Outbound agent messaging into the group chat (saved for v2 — see §13).
- Calendar / Reminders / email integrations (v2).
- Mobile UI (dashboard is desktop-web only).
- Billing, onboarding, account management.

---

## 4. Non-goals

- **Replacing Programa.** Airtable is the agent's scratchpad, not a CRM replacement. The digest is the handoff.
- **Fully autonomous action.** Every extraction is reviewable. The agent never sends an iMessage in MVP.
- **Cross-platform support.** macOS-side local `chat.db` is explicitly not used — all iMessage traffic goes through Linq.
- **Pretty.** Dashboard is functional, not polished. Use Airtable's native interface views for anything we don't need to customize.

---

## 5. User flow (demo narrative)

1. Mom adds the Linq-provisioned iMessage number ("Studio Assistant") to an existing client group chat — the same way she'd add any other participant.
2. Project metadata is bootstrapped via the dashboard: project name, client name, address, budget, phase. One form, ~30 seconds.
3. Conversations continue naturally. The agent does not post in the group. Clients don't notice it.
4. Each inbound message triggers: Linq webhook → server → Claude extraction → Airtable write (if anything was extracted).
5. Throughout the day, mom opens the dashboard and sees, per project, a reverse-chronological feed of extracted items: "Client approved the Baxter sofa in emerald velvet — $4,200," "Reschedule Thursday install to Friday 10am," "Client asked for pricing on two lamp options by EOW."
6. Each item has: source message link, confidence score, accept / edit / reject buttons.
7. At end of day (or on demand), mom clicks "Generate digest" for a project. Output is a markdown block scoped to unsynced items, formatted to paste into Programa's project notes field.
8. Once pasted (manually — not automated), she clicks "Mark synced" and those items drop from the active feed.

---

## 6. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  iMessage group chat (mom + client + "Studio Assistant")      │
└────────────────┬───────────────────────────────────────────────┘
                 │ inbound message
                 ▼
┌────────────────────────────────────────────────────────────────┐
│  Linq Blue API                                                 │
│  - Provisioned iMessage number                                 │
│  - Webhook on message.created                                  │
└────────────────┬───────────────────────────────────────────────┘
                 │ POST /api/linq/webhook
                 ▼
┌────────────────────────────────────────────────────────────────┐
│  Next.js app (Vercel)                                          │
│                                                                │
│  /api/linq/webhook  ─── verify signature                       │
│                    ─── idempotency check (Airtable lookup)     │
│                    ─── enqueue                                 │
│                                                                │
│  Extraction worker ─── load project context from Airtable      │
│                    ─── Claude Sonnet 4.6 tool-use call         │
│                    ─── write structured items to Airtable      │
│                                                                │
│  /dashboard         ─── per-project feed (reads Airtable)      │
│                    ─── accept/reject/edit                      │
│                    ─── generate digest                         │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────┐
│  Airtable (single base, serves as DB + reviewable UI fallback)│
│  Tables: Projects, Messages, Items, Participants               │
└────────────────────────────────────────────────────────────────┘
```

Everything runs on Vercel's serverless free tier for the demo. No separate queue, no separate DB. Airtable is the persistence layer. The extraction call runs inline in the webhook handler (under Vercel's 60s timeout — each call is ~2–5s).

---

## 7. Stack (opinionated)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript | Type safety for Claude tool-use schemas; Linq's reference agent is JS-friendly. |
| Runtime | Node 20+ on Vercel serverless | Webhook-ideal; zero ops for demo; free tier covers it. |
| Framework | Next.js 15 (App Router) | API routes + dashboard in one deployment. |
| LLM | Claude Sonnet 4.6 (`claude-sonnet-4-6`) via Anthropic SDK | Extraction quality > speed; ~$0.003/msg ballpark. |
| Messaging | Linq Blue API | Required. Use the official REST client if they publish one; otherwise `fetch`. |
| DB / store | Airtable (single base) | Doubles as review UI, zero infra, fast to iterate on schema. |
| Frontend | Next.js + Tailwind + shadcn/ui | Dashboard is one route, one table per project. |
| Auth | Single env-var shared password (middleware) | MVP only; not a real auth story. |
| Secrets | Vercel env vars | `LINQ_API_KEY`, `LINQ_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `DASHBOARD_PASSWORD`. |
| Observability | Vercel logs + a single `events` table in Airtable | Enough to debug during the demo. |

**Explicitly rejected:**
- Postgres / Supabase — unnecessary second store when Airtable is already the review layer.
- Bun / Deno — marginal wins, Vercel's Node path is the smoothest.
- A separate job queue — Claude calls fit in the webhook's 60s budget.
- Python/FastAPI — fine choice, but TS keeps Claude tool-use schemas and frontend in one language.

---

## 8. Data model (Airtable)

One base, five tables. Field types in parentheses.

**Projects**
- `Name` (text, primary)
- `Client` (linked record → Participants)
- `Address` (text)
- `Budget` (currency)
- `Phase` (single select: Lead, Design, Procurement, Install, Complete)
- `Linq chat ID` (text, unique — binds to the iMessage group)
- `Context notes` (long text — free-form context the operator writes for the agent)
- `Status` (single select: Active, Paused, Archived)

**Participants**
- `Name` (text, primary)
- `Phone` (phone)
- `Role` (single select: Client, Designer, Contractor, Vendor, Other)
- `Projects` (linked → Projects)

**Messages** (raw inbound log, for dedup + source-linking)
- `Linq message ID` (text, unique, primary)
- `Chat ID` (text)
- `Project` (linked → Projects, computed via Chat ID)
- `Sender phone` (text)
- `Sender name` (lookup via Participants)
- `Body` (long text)
- `Attachments` (attachments)
- `Timestamp` (datetime)
- `Processed` (checkbox)
- `Extraction error` (long text, optional)

**Items** (the agent's extracted structured output — this is what mom reviews)
- `Summary` (text, primary — 1 sentence)
- `Project` (linked → Projects)
- `Source message` (linked → Messages)
- `Type` (single select: Decision, Action item, Budget change, Schedule, Product/vendor, Address/logistics, Question, Other)
- `Details` (long text — structured JSON blob the agent emitted)
- `Confidence` (number 0–1)
- `Status` (single select: Pending, Accepted, Edited, Rejected, Synced)
- `Owner` (single select: Designer, Client, Contractor — who is responsible if action item)
- `Due` (date, optional)
- `Created` (datetime)
- `Reviewed at` (datetime, optional)

**DigestRuns** (audit trail of "I pasted this into Programa on date X")
- `Project` (linked → Projects)
- `Generated at` (datetime, primary)
- `Item count` (number)
- `Digest markdown` (long text)
- `Confirmed synced at` (datetime, optional)

---

## 9. Components

### 9.1 Linq webhook handler — `app/api/linq/webhook/route.ts`

Responsibilities:
1. Verify Linq webhook signature (HMAC — spec TBD, confirm from apidocs.linqapp.com).
2. Parse event. Only act on `message.created` where the message is inbound and in an allowlisted chat.
3. Dedup against `Messages.Linq message ID`. If we've seen it, 200 and exit.
4. Resolve `Chat ID → Project`. If not mapped, log and 200 (we still store the raw message for debugging but don't extract).
5. Persist the raw message to `Messages`.
6. Invoke extraction (inline, awaited).
7. 200 regardless of extraction outcome — don't make Linq retry on our logic bugs. Errors go to `Messages.Extraction error`.

### 9.2 Extraction worker — `lib/extract.ts`

Pure function: `extract(message, project, recentContext) → Item[]`

- Loads: project metadata, last 20 messages from the same chat (for pronoun / context resolution), the project's free-form `Context notes`.
- Calls Claude Sonnet 4.6 with structured tool-use. One tool: `emit_items`, with JSON schema matching the `Items` shape (type, summary, owner, details, due, confidence).
- Claude may emit 0, 1, or N items per message. A single message can contain multiple extractable facts ("Let's move Thursday to Friday and also add the ottoman" = 2 items).
- Any emitted item with `confidence < 0.4` is still stored but auto-flagged for stricter review in the UI.
- Errors (API failure, malformed tool output, timeout) are caught and logged to the message row; they do not propagate.

### 9.3 Extraction prompt (strategy, not literal text)

System prompt must establish:
- Role: extraction assistant for a solo interior designer, working from a group chat.
- The known participants (with names and roles).
- Project metadata: name, address, budget, phase, free-form context.
- The last N messages for pronoun resolution.
- Hard rules:
  - Only emit items for substantive content. Chit-chat, greetings, "sounds good," "ok 👍" → emit nothing.
  - Never invent facts. If the message references "the sofa" and no sofa is established in context, either leave `details` vague or emit nothing.
  - Due dates: only populate if the message is explicit ("by Friday," "before the install"). Never guess.
  - Owner: only populate if clear from phrasing ("I'll send you the link" → Client; "I'll order it Monday" → Designer).
  - Confidence should reflect how much inference was needed. Verbatim = 0.9+. Paraphrased = 0.7. Inferred = 0.5. Guess = skip.

### 9.4 Dashboard — `app/dashboard/[projectId]/page.tsx`

Server component that reads `Items` filtered by project and `Status != Synced`, ordered by `Created desc`. For each item row:
- Colored badge for `Type`.
- Summary, owner, due date.
- Confidence as a subtle indicator (dot or bar).
- Source message quote on hover or expand.
- Accept / Edit / Reject buttons (server actions; update `Status` + `Reviewed at`).
- Bulk actions: "Accept all above 0.8 confidence."

Top of page: project metadata + a "Generate digest" button.

### 9.5 Digest generator — `lib/digest.ts`

Pulls all `Items` for a project where `Status in [Accepted, Edited]` and `DigestRuns` has never included them. Formats as a markdown block:

```markdown
## Project update — Smith residence — 2026-04-21

### Decisions
- Client approved Baxter sofa in emerald velvet ($4,200)

### Action items
- [Designer] Send pricing on two lamp options by Fri 4/25
- [Client] Confirm bathroom tile selection by 4/23

### Schedule
- Install moved from Thu 4/24 → Fri 4/25 @ 10am

### Budget
- Sofa: +$4,200 (was placeholder at $3,500) — net +$700
```

Creates a `DigestRuns` row with the generated markdown. Items get `Status = Synced` when user clicks "Mark synced" after paste.

### 9.6 Dashboard auth

Next.js middleware checks a `dashboard_auth` cookie. Single `/login` page posts password → sets cookie. Trivial for demo; replace before any real user touches it.

---

## 10. External APIs

**Linq Blue API**
- Auth: API key in header (exact header TBD from apidocs).
- Sending (not used in MVP): `POST /messages` with `chat_id` and `body`.
- Webhooks: `message.created` event, POST to our endpoint with signed body. Subscribe via dashboard or API.
- Group chat add: mom adds the number manually from Messages.app, same as any other participant. We watch `chat.created` or resolve-on-first-message.
- Rate limits: unknown — confirm. Volume will be low (<100 msgs/day across all projects).

**Anthropic (Claude Sonnet 4.6)**
- `messages.create` with `tools: [{ name: 'emit_items', input_schema: {...} }]` and `tool_choice: { type: 'tool', name: 'emit_items' }`.
- Max tokens: 2000 (extractions are short).
- Expected ~$0.003–$0.008 per message at typical input sizes (20-message context window + system prompt).

**Airtable**
- Personal Access Token.
- Rate limit: 5 req/sec per base. Batch writes up to 10 records per request. At demo volume we're nowhere near this.
- Use `performUpsert` on `Messages` (keyed by `Linq message ID`) for idempotent writes.

---

## 11. Security & privacy

For MVP demo only. Not production-grade.
- No PII in logs. Redact phone numbers and addresses from any `console.log`.
- Airtable base is private to a single account.
- Webhook endpoint validates Linq's signature; unsigned requests 401.
- `ANTHROPIC_API_KEY` uses Anthropic's zero-retention where available.
- Linq is SOC 2 Type II, which is the one piece of this stack that's actually enterprise-grade. Lean on that in the pitch.
- Before any real (non-demo) user: proper auth, encrypted-at-rest, DPA with Anthropic, informed-consent flow for the iMessage participants.

---

## 12. Demo script (5 minutes)

**Setup before the demo**
- Dedicated Linq sandbox number.
- Two seeded projects in Airtable: "Smith residence" and "Chen loft."
- Two seeded group chats on your phone: you + 2 alt accounts (could be Signal-style burner numbers or friends).
- Dashboard open in browser on the presentation screen.

**Minute 0–1: Setup the problem.**
_"My mom is an interior designer. Every client conversation is in iMessage. Her CRM has none of it. This is that problem."_

Show Programa (screenshot) next to her real iMessage (screenshot). The gap is visceral.

**Minute 1–2: Add the agent.**
Live: pull up a seeded group chat, add "Studio Assistant" as a participant. _"No app download. No client onboarding. The agent is just another participant in the chat."_

**Minute 2–3: Live conversation.**
From your second phone (the "client"), send 4–5 prepared messages over ~60 seconds: a scheduling change, a product approval, a budget question, a follow-up ask. Watch the dashboard populate in real time.

**Minute 3–4: Review & accept.**
_"Everything the agent pulled out. Confidence scores. Source messages on hover. One click accepts, one click rejects, edit in place."_ Accept a few, edit one, reject one.

**Minute 4–5: The handoff.**
Click "Generate digest." Show the clean markdown. _"This is what goes into Programa. The CRM has no API — that's the point. The agent doesn't need one. It reduces the CRM update from 'reconstruct the week' to 'paste this.'"_

Close: _"Linq is what makes this real. Native iMessage, group chats, SOC 2 — nothing else in the stack can legitimately sit in the middle of a client conversation. This pattern generalizes to any small-business operator whose CRM is a walled garden, which is most of them."_

---

## 13. Build plan / milestones

Rough sequencing, not timeboxes.

**M1 — Infra skeleton (day 1)**
- Vercel project, env vars, Airtable base + schema, Linq sandbox account, Anthropic key.
- Deployed webhook endpoint that logs and 200s.
- Verified webhook signature + end-to-end: send a message in the sandbox → see it land in Airtable `Messages`.

**M2 — Extraction path (day 2)**
- Claude tool-use call with stubbed project context.
- Items written to Airtable.
- Hand-test: send 10 varied messages in the sandbox, verify extractions manually, tune prompt.

**M3 — Dashboard (day 3)**
- Project page reading from Airtable.
- Accept / reject / edit server actions.
- Dead-simple auth middleware.

**M4 — Digest + polish (day 4)**
- Digest generator + "Mark synced" flow.
- Seed two real-looking projects.
- Write demo script; rehearse end-to-end.

**M5 — Demo rehearsal (day 5)**
- Full run-through with prepared messages.
- Fix any embarrassments.

Total: ~5 focused days for a single builder. Expand if extraction quality needs more prompt work.

---

## 14. v2 hooks (out of MVP, but design for)

Not built in MVP; the architecture should not preclude these.

- **Outbound agent messages.** Let mom type "summarize for the client" in the dashboard; agent drafts, she approves, Linq sends into the group chat.
- **Proactive nudges.** Agent detects an unanswered client question 24h later and drafts a reply for mom.
- **Calendar integration.** Scheduling items auto-create Google Calendar events.
- **Reminders.** Action items with due dates sync to Apple Reminders / Todoist.
- **Vendor link enrichment.** Detects supplier URLs, scrapes them (Programa already does this internally — we could mirror for the digest).
- **Attachments.** Photo of a fabric swatch → auto-tagged to a room.
- **Multi-tenant.** Actual auth, per-user Airtable bases (or migrate to Postgres).

---

## 15. Risks & open questions

**Must resolve before/during build:**
1. **Does Linq webhook fire on every message in a group chat, or only @mentions of the agent?** If the latter, the silent-observer pattern doesn't work and we need to rethink. First thing to confirm with Linq.
2. **Can the agent be added to a pre-existing group chat by the end user (mom), or does it require the group to be created with the agent from the start?** iMessage group semantics are finicky. Test in the sandbox day 1.
3. **Message ordering and delivery guarantees from Linq webhooks.** Do we need to reorder by timestamp? What happens if two webhooks race?
4. **Extraction quality.** This is the product. Budget real prompt-iteration time and build a small eval harness (10–20 hand-labeled messages) by day 2 so tuning is measurable.

**Known constraints to live with:**
- No Programa API. Digest-paste is the handoff. Don't try to fix this in MVP.
- iMessage reactions / tapbacks are supported by Linq but produce noisy webhooks. Filter them out in MVP; revisit in v2.
- Attachments in MVP: store them in Airtable's `Attachments` field, surface them in the dashboard, but don't try to extract information from images yet.

**Strategic unknowns:**
- Ethics/consent: does mom tell her clients there's an agent in the chat? For the demo, yes (and use test phones). Before any real deployment, this is a real conversation — arguably the hardest product question in the whole concept.
- Linq's policy on agents that observe without introducing themselves. Worth asking them directly during the demo conversation.

---

## 16. Open to revise

This spec is v0.1. The things most likely to change after day-1 Linq sandbox testing:
- Data model of `Items` — likely needs more types once we see real messages.
- Whether extraction is per-message or windowed (every 5 messages, or debounced). Per-message is simpler to build; windowed produces cleaner extractions because conversation often needs a few turns to settle a decision.
- Dashboard: Airtable's native interface views may be good enough to skip Next.js dashboard for MVP. Decide after M2.
