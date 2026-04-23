# Product Requirements Document — Thread

**Version:** 0.1 (MVP)
**Date:** 2026-04-21
**Owner:** Dylon
**Status:** Draft — pre-build
**Related:** `spec.md`, `SRS.md`, `SDD.md`, `TECH_STACK.md`

---

## 1. Executive summary

Thread is an iMessage agent for solo and small-studio service operators who run their client relationships in iMessage while their CRM sits blind. The agent is added as a silent participant to existing client group chats. It extracts structured updates from the conversation — decisions, action items, budget changes, scheduling, vendor references — and maintains a reviewable working memory the operator uses to keep their CRM honest.

The MVP targets a single user: a solo interior designer whose CRM (Programa) has no public write API. The product's core claim is that 90% of the pain of "keeping the CRM up to date" is the extraction work, not the writing. Thread owns the extraction, not the CRM.

## 2. Problem

### 2.1 Context

Client-services professionals — interior designers, real-estate agents, photographers, event planners — do the substantive work of their businesses in iMessage. Decisions, approvals, schedule changes, and scope creep happen in blue bubbles, often across many group chats with clients, contractors, and vendors. Their systems of record are supposed to be CRMs (Programa, Studio Designer, Dubsado, Follow Up Boss), but in practice those systems are updated from memory at the end of the week, if at all.

This produces predictable failure modes:

- Forgotten client approvals that have to be re-litigated.
- Missed follow-ups because an ask scrolled off.
- Budget drift, because mid-conversation approvals don't make it into the project ledger.
- End-of-week admin tax: 2–4 hours reconstructing "what did we decide" from scrollback.

### 2.2 Why it hasn't been solved

Two simultaneous barriers:

- **iMessage is closed.** Apple has no public iMessage API. The only sanctioned integration paths either don't support group chats (Apple Messages for Business) or are being shut down by Apple in June 2026 (private-API bridges like LoopMessage, SendBlue). Linq's Blue API is one of the few SOC 2–compliant, group-chat-capable options, and it's new enough that the agent ecosystem around it is nascent.
- **Most vertical CRMs have no developer API.** Programa is representative: Xero and QuickBooks integrations only, no webhooks, no Zapier, no public endpoints. Any solution that promises to "sync your iMessage to your CRM" for these verticals runs into the same wall.

Thread threads the needle by reframing: the valuable work is the structured extraction, not the CRM write. The write becomes a one-click paste.

### 2.3 Pain quote (representative)

> "Everything important about my projects is in iMessage and it never makes it into Programa until I sit down on Sunday and force it to. By then I've lost half of it."
> — Target persona

## 3. Target user

### 3.1 Primary persona — "Solo Interior Designer"

- **Name (for design purposes):** Jen
- **Business:** Solo designer, runs her own studio. 5–15 active projects at any time.
- **Tools:** Programa (CRM/project), Xero (accounting), iMessage (client comms), Gmail (vendor comms), Instagram (inspo / lead gen).
- **Tech comfort:** Medium. Lives in her phone. Not afraid of software but has no patience for tools that require daily maintenance.
- **Day shape:** On-site at client homes or vendor showrooms most of the day. Admin happens in 30-min bursts between meetings and 2-hour blocks on weekends.
- **Goal:** Spend less time on admin, never lose a client decision.
- **Fears:** Adding another tool to her stack. Privacy — her clients' conversations are sensitive.

### 3.2 Secondary persona (deferred, v2+)

- **Name:** Real-estate agent working buyer-side. Same structural problem, different CRM (Follow Up Boss, which _does_ have an API — different product shape becomes possible).

### 3.3 Non-users (explicitly)

- Enterprise design firms with admin staff (different problem: delegation, not memory).
- SMS-heavy businesses (product is iMessage-first).
- Businesses with CRMs that already have good messaging integrations (HubSpot, Salesforce, Follow Up Boss).

## 4. User stories (MVP)

Format: _As a [user], I want [capability], so that [outcome]._

### 4.1 Must-have for demo

- **US-1.** As Jen, I want to add Thread's iMessage number to an existing client group chat the same way I'd add any other contact, so that I don't have to start a new chat or change client behavior.
- **US-2.** As Jen, I want Thread to automatically associate a group chat with a specific project in my dashboard, so that extracted items land in the right place without me managing the mapping manually.
- **US-3.** As Jen, I want every substantive message in the group chat to be analyzed for decisions, action items, schedule changes, budget updates, and product/vendor references, so that nothing important falls through.
- **US-4.** As Jen, I want to see a live feed of extracted items per project on a web dashboard, so that I can review a day's worth of extractions in 2 minutes instead of scrolling through three weeks of messages.
- **US-5.** As Jen, I want to accept, edit, or reject each extracted item individually, so that the record reflects what I actually believe happened.
- **US-6.** As Jen, I want to generate a formatted digest of accepted items for a project, so that I can paste it directly into Programa's notes without reformatting.

### 4.2 Should-have if time permits

- **US-7.** As Jen, I want Thread to flag questions from clients that I haven't answered in 24+ hours, so that I don't miss a response.
- **US-8.** As Jen, I want to bulk-accept all high-confidence items (>0.8) with one click, so that review doesn't become its own chore.

### 4.3 Explicitly deferred

- Writing back to Programa automatically.
- Sending messages into the group chat on Jen's behalf.
- Calendar / Reminders / email integrations.
- Mobile UI.
- Multi-tenant support.

## 5. Success metrics

MVP is a demo, not a product launch. Success is measured against the demo's purpose: showing Linq's team a credible, buildable agent that makes the case for their infra.

### 5.1 Demo success (primary)

- End-to-end walkthrough works live without intervention. Add-to-group → send messages → see extractions appear → accept → generate digest, all in under 5 minutes.
- Extraction quality is visibly good. On 20 prepared messages, the extraction pass reaches ≥80% precision and ≥70% recall by human judgment.
- Linq team asks follow-up questions about integrating into existing workflows. (Signal: the demo opens a real conversation, not just a polite nod.)

### 5.2 Product signals (secondary, post-demo)

- Jen (the real designer) uses it on one real project for 5 business days and reports: (a) she reviewed extractions daily, (b) she generated and used at least one digest, (c) she'd use it again.
- Extraction error rate on real (vs seeded) conversations stays under 25%.

### 5.3 Non-metrics

- Ignoring: daily active users, retention curves, NPS. This is pre-product.
- Ignoring: Programa integration depth. The whole thesis is we don't need it.

## 6. Product scope

### 6.1 In scope for MVP

- iMessage group chat integration via Linq Blue API (single provisioned number).
- Inbound message capture and persistence.
- Per-message structured extraction using Claude Sonnet 4.6.
- Web dashboard for per-project review (accept / edit / reject).
- Digest generation (markdown output, copy-paste handoff).
- Single-user auth (shared password).
- Demo environment with seeded projects and test group chats.

### 6.2 Out of scope for MVP

- CRM write-back (Programa or any other).
- Outbound agent messages into group chats.
- Voice, RCS, SMS handling (Linq supports all three; we only use iMessage).
- Calendar, Reminders, email, Contacts integrations.
- Mobile app or mobile-responsive dashboard.
- Multi-user, multi-tenant, or team support.
- Billing and account management.
- SSO, SAML, org-level auth.
- Historical message backfill on chat add (only new messages are processed).
- Search across messages or extractions.

### 6.3 Non-goals

- **Thread is not a CRM.** Airtable is a staging layer and review UI, not a system of record. Programa remains the SoR.
- **Thread is not autonomous.** Every extraction is reviewable. The agent does not act on Jen's behalf in MVP.
- **Thread is not a chatbot.** Clients never interact with it. They don't know it's there unless Jen tells them.

## 7. User journey

### 7.1 First-run setup

1. Jen receives a Linq-provisioned number and dashboard URL + password.
2. She logs in. Empty dashboard.
3. She creates a Project: name, client, address, budget, phase.
4. On her phone, she opens an existing client group chat, adds the Linq number as a participant.
5. On her dashboard, she sees the new chat appear under "Unmapped chats." She binds it to the project she just created.
6. Setup complete — ~2 minutes.

### 7.2 Steady state (daily)

1. Jen's client group chats continue as normal. Thread's number is silent.
2. Throughout the day, Jen glances at her dashboard. Per project, a feed of extracted items: decisions, action items, scheduling, budget changes.
3. She accepts, edits, or rejects each item. Bulk-accept for obvious ones.
4. End of day: she clicks "Generate digest" on a project. Copies the markdown. Pastes into Programa's project notes. Clicks "Mark synced."
5. Total admin time reclaimed: the 2–4 hours of Sunday reconstruction, minus ~15 minutes of daily review.

### 7.3 Edge cases the MVP must handle gracefully

- Extraction returns nothing for a message (chit-chat). Expected; do not create an item.
- Extraction fails (API error, malformed output). Log on the message row; surface a small banner on the dashboard but don't block other extractions.
- Client adds a new participant (contractor joins the chat). iMessage may create a new `chat_id`. Dashboard should flag "new chat detected — bind to existing project?"
- Jen sends a message in the chat herself. It will come through the webhook. Extraction runs, but items should be attributed correctly.
- Client sends a photo of a fabric swatch. MVP stores the attachment but doesn't extract from images. Surface the attachment in the dashboard.
- Two messages arrive within the same second (client typing quickly). Both must be processed in order; no silent drops.

## 8. Competitive & adjacent landscape

### 8.1 Closest adjacent products

- **Sendblue, LoopMessage, Beeper, Blooio** — iMessage APIs. Competitors to Linq, not to Thread. Most have private-API risk going into June 2026.
- **Superhuman, Shortwave, Granola** — AI layers on top of email / meetings. Same architectural pattern (agent observes comms, surfaces structured takeaways) in adjacent verticals.
- **Hampton, Paul, Rewind** — personal "memory" agents. Operate on personal data rather than client comms. Different user.
- **Programa, Studio Designer, Dubsado** — CRMs, not agents. They're what Thread interoperates with (via digest, not API).

### 8.2 Differentiators

- Lives inside the actual conversation, not in a sidebar.
- Client-facing surface is zero. No friction on the client side.
- Structured extraction, not transcription or summary. Output is typed and reviewable.
- CRM-agnostic by design (consequence of no CRM APIs existing, recast as a feature).

### 8.3 Threats / risks

- Apple changes iMessage group-chat semantics in a way that breaks Linq (Apple has a track record here).
- A vertical CRM (Programa or Dubsado) ships a native iMessage integration and eats this category for their users.
- LLM extraction quality is not reliable enough and the review burden negates the time savings.

## 9. Assumptions

- Linq's webhook fires on every message in group chats the agent participates in (verified — see answers to open questions in prior research).
- Jen can add the Linq number to existing chats from her phone like any other contact (verified, with iMessage's "new chat on participant change" quirk to handle).
- Claude Sonnet 4.6 extraction quality is high enough to make review feel like editing, not authoring.
- Clients will not object to the presence of an additional unrecognized number in the chat — or Jen will tell them, and they won't object. This is the biggest social assumption in the product and warrants explicit consent flow before any non-demo deployment.

## 10. Constraints

- Must use Linq Blue API for iMessage (product requirement — the whole demo is for Linq).
- Cannot depend on a Programa API (it doesn't exist).
- Single-developer build. No team. Must be demo-able in ~5 working days.
- No budget for paid infra beyond free tiers (Vercel free, Airtable free/paid-personal, Anthropic API pay-as-you-go, Linq sandbox).

## 11. Open questions for stakeholders

- **For Jen:** would she be comfortable telling clients "I use an assistant to help me keep track of our conversation"? What framing does she want?
- **For the Linq team:** is the silent-observer pattern something they actively support, actively discourage, or neutral on? Any policy considerations around unannounced AI participants in consumer conversations?
- **For future scope:** at what point does this become a Programa partnership conversation rather than a Programa-adjacent product?

## 12. Out-of-scope thinking (documented so it's not re-litigated)

- **"Why not just have the CRM ingest iMessage directly?"** — The CRM doesn't have an API. Even if it did, the value is the extraction, not the pipe.
- **"Why not a browser extension in the Programa web app?"** — Doesn't solve the iMessage side. The whole problem is comms-to-record, not in-record.
- **"Why not WhatsApp / SMS?"** — Jen's conversations are in iMessage. Solving where she already is beats asking her to change.
- **"Why not voice memos and transcription?"** — Additive, not core. Save for v2.
