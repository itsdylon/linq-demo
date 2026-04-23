# Tech Stack — Thread

**Version:** 0.1 (MVP)
**Date:** 2026-04-21
**Owner:** Dylon
**Status:** Draft — pre-build, decisions made
**Related:** `PRD.md`, `SRS.md`, `SDD.md`

---

## 1. Stack at a glance

| Layer | Choice | Why in one line |
|---|---|---|
| Language | TypeScript 5.x | Type-safe Claude tool schemas + Linq payload shapes in one language across backend and dashboard. |
| Runtime | Node.js 20+ | Stable LTS, broad library support, matches Vercel defaults. |
| Framework | Next.js 15 (App Router) | Webhook endpoint + server-rendered dashboard + server actions in one codebase. |
| Hosting | Vercel (Hobby) | Zero-ops serverless; auto-deploys on push; free tier covers demo load. |
| Package manager | pnpm | Fast, disk-efficient, monorepo-ready if the project grows. |
| LLM | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Best extraction quality at acceptable price; tool-use is mature. |
| Messaging | Linq Blue API (Partner v3) | Required constraint; also the one SOC 2 Type II iMessage API that supports group chats. |
| Persistence | Airtable (single base) | Doubles as admin UI; zero infra; schema iteration in seconds. |
| Frontend | React (in Next.js), Tailwind CSS, shadcn/ui | Standard Next.js story; shadcn for pre-styled primitives. |
| Auth | Signed session cookies + single shared password | MVP-appropriate. Real auth is a v2 problem. |
| Dev tools | Vitest, Biome, tsx, ngrok | Test, lint, run, and tunnel webhooks locally. |
| Version control | Git + GitHub | Default choice. |
| CI/CD | Vercel Git integration | Push to `main` → prod. No separate CI in MVP. |

Everything above is opinionated. Rationale and rejected alternatives below.

---

## 2. Language & runtime

### 2.1 TypeScript

**Why:**
- Claude tool-use relies on JSON schemas. TypeScript lets us derive types from those schemas (via `zod-to-json-schema` or Anthropic's own helpers) so the extracted payload is typed end-to-end.
- Linq webhook payloads and Airtable record shapes both benefit from nominal types to prevent "which string is this?" bugs.
- One language across frontend and backend removes a context-switch cost for a solo builder.

**Rejected alternatives:**
- **Python (FastAPI).** Closer to the AI/ML ecosystem and arguably a faster path to a prototype. Rejected because splitting language between server and dashboard doubles the mental model.
- **Go.** Overkill for a 5-day MVP. No meaningful advantage over TS here.
- **Ruby / Rails.** No.

### 2.2 Node.js 20+

Default runtime that Vercel supports natively. No reason to choose Bun or Deno:

- **Bun** is fast and has native TypeScript, but Vercel's first-class path is Node. Deploying Bun on Vercel is possible but adds friction.
- **Deno** has the best default ergonomics but weaker Vercel integration.

For MVP, frictionless deploy > marginal runtime wins.

---

## 3. Framework

### 3.1 Next.js 15 (App Router)

**Why it fits this product exactly:**
- The webhook endpoint (`/api/linq/webhook`) and the dashboard live in one deployment, one codebase, one logs stream.
- Server Components + Server Actions remove the need for a separate API layer for the dashboard. The Airtable adapter is called directly from server components.
- Tight Vercel integration — `vercel` CLI + Git push is the entire deploy pipeline.

**Trade-offs accepted:**
- 10-second function timeout on Hobby (60s on Pro). Extractions fit comfortably, but a future batch-extraction path would want a queue.
- Server Actions are newer API surface; occasional DX rough edges.

**Rejected alternatives:**
- **Express / Fastify standalone backend + separate React frontend.** Two deployments, two auth stories, two build pipelines. No.
- **Hono on Cloudflare Workers.** Tempting for the webhook half — faster cold starts, longer CPU budget on paid tier. But we'd still need somewhere to host the dashboard, and splitting the system doubles the setup cost.
- **SvelteKit / Remix.** Fine frameworks; no advantage for this workload over Next.js in the Vercel ecosystem.

---

## 4. Hosting & deploy

### 4.1 Vercel (Hobby tier)

**Why:**
- Free for this volume.
- Git-push deploys. No CI/CD to build.
- Good logs UI, good env var management, fast deploys.
- Preview deployments on every PR — useful for Linq webhook testing without disturbing prod.

**Limits we need to know:**
- 10s function timeout on Hobby. Extraction averages 3–5s, headroom is fine. If we add outbound messaging or vision in v2, may need Pro ($20/mo, 60s timeout).
- 100 GB-hours/month bandwidth. Nowhere near.
- 100 deployments/day. Not a concern.

**Rejected alternatives:**
- **Railway / Fly.io.** Would run persistent processes (useful if we add a queue later), but persistent ≠ free. Worse fit for webhook-shaped workloads.
- **AWS Lambda + API Gateway.** More control, much more config. Wrong trade for 5 days.
- **Cloudflare Workers.** 50ms CPU on free tier rules out synchronous LLM calls in the request handler.

---

## 5. LLM

### 5.1 Claude Sonnet 4.6 (`claude-sonnet-4-6`)

**Why:**
- Extraction quality matters more than latency or cost here. Sonnet's reasoning and instruction-following are the right fit for "read this message, decide what's worth recording."
- Tool use with structured output is well-supported and stable.
- Anthropic ecosystem parity with the demo context (Linq is an Anthropic partner; Linq's reference iMessage agent is Claude-powered).

**Cost expectation:**
- ~$0.003–$0.008 per extraction at typical context size (~500 input tokens + ~200 output). At 500 messages/day: ~$1.50–$4/day. Comfortable.

**Rejected alternatives:**
- **Claude Haiku 4.5.** Cheaper and faster. Likely fine for simple extractions but we're pushing quality in a demo; Sonnet's ceiling matters more than Haiku's floor.
- **Claude Opus 4.6.** Overkill and expensive for single-message extraction.
- **GPT-4.1 / GPT-5.** Comparable quality; Anthropic alignment with the Linq demo context tips it.
- **Local / open-weights (Llama 3.x, Qwen).** Operational cost way up, quality meaningfully down. Not for MVP.

### 5.2 Anthropic SDK

Use `@anthropic-ai/sdk`. Native TS types, official support, straightforward tool-use API.

---

## 6. Messaging

### 6.1 Linq Blue API (Partner v3)

Required by the demo context. Independent of that: it's the best option on the market today for iMessage + group chats + SOC 2. No serious alternative for MVP.

**Integration model:**
- Outbound HTTP client for subscription management (one-time) and, in v2, for sending messages.
- Inbound webhook receiver verifies HMAC signatures (format: `HMAC-SHA256(signing_secret, timestamp + "." + raw_body)`, header names `X-Linq-Signature` and `X-Linq-Timestamp`).
- Use Linq's sandbox for dev; promote to production tenant when needed.

**What we use in MVP:** inbound only.
**What we don't use:** outbound messages, reactions, typing indicators, RCS, SMS, voice.

---

## 7. Persistence

### 7.1 Airtable

**Why it's the right call for MVP:**
- **Doubles as admin UI.** Any data the system produces is inspectable and editable by the operator in Airtable's native interface. Saves building a whole admin tool.
- **Schema iteration in seconds.** Add a field in the UI, start writing to it. No migrations, no ORMs.
- **Reasonable API.** REST with batching, upserts, filter formulas. 5 req/s per base limit — fine for MVP volume.
- **Shareable.** If we need a second reviewer (the operator's assistant, say), it's an email invite.

**Limits we accept:**
- 5 requests/second per base. Not a concern at MVP volume (<500 msg/day, ~1500 ops/day).
- ~100ms roundtrip per op. Additive but fine.
- Not a real database — weak querying, no transactions, no true foreign keys. Good enough for the MVP data model; real problem at ~10× scale.
- Free tier has record caps (1,200 records per base on Free, 5,000 on Team). Budget: plan for Team ($10/user/mo) if we expect >1,000 messages processed.

**Rejected alternatives:**
- **Supabase / Postgres.** Correct long-term choice. Too heavy for MVP: schema-first migrations, separate admin UI, Postgres type mapping across Airtable doesn't exist. Defer to v2.
- **SQLite (on Vercel KV or Turso).** Lightweight, but no admin surface. We'd spend a day on a CRUD UI that Airtable gives us free.
- **Firebase.** NoSQL quirks, more complex auth surface, less comfortable TS story.
- **A JSON file in git.** Yes I thought about it. No.

### 7.2 Airtable client

Use `airtable` (official) npm package, wrapped in `lib/airtable.ts` to give us:
- Typed table accessors (one function per table CRUD operation).
- Consistent error handling + 429 backoff.
- Primary-key upsert (using `performUpsert` + `fieldsToMergeOn`).

---

## 8. Frontend

### 8.1 React + Tailwind + shadcn/ui

**Why:**
- React ships with Next.js; not a decision.
- Tailwind is the fastest path to "looks fine" without designing a system.
- shadcn/ui provides polished primitives (buttons, cards, dialogs, forms) that we own in our repo and can customize.

**What we build by hand vs use libraries for:**
- Build by hand: layout, the Items feed, the digest modal.
- Use shadcn: buttons, inputs, cards, dialogs, toasts.
- Avoid: component libraries with heavy theming systems (MUI, Mantine). Overkill for one dashboard.

### 8.2 No state management library

No Redux, no Zustand, no React Query. Server Components + Server Actions cover everything we need. The moment we need client-side cache invalidation across views, revisit.

### 8.3 Icons

Lucide (`lucide-react`). Ships with shadcn ecosystem anyway.

---

## 9. Authentication

### 9.1 Single shared password, signed session cookie

**Why:**
- Single-user MVP. A real auth provider (Clerk, Auth.js, Supabase Auth) is 2 hours of setup for a feature we don't need.
- Signed HTTP-only cookies are well-supported in Next.js middleware.

**Implementation:**
- `/login` page with one password field.
- `POST /api/login` compares to `DASHBOARD_PASSWORD` env var, sets a signed cookie (`iron-session` library or hand-rolled with `jose`).
- `middleware.ts` validates the cookie on every dashboard route.

**v2:** swap in Clerk or Auth.js when multi-user is on the table. Self-contained, easy swap.

---

## 10. Dev tools

### 10.1 Vitest

Tests for pure functions: HMAC verification, digest markdown rendering, extraction prompt composition, Airtable adapter transforms. Not E2E.

### 10.2 Biome

Linter + formatter in one. Faster than ESLint + Prettier; fewer config files. Opinionated defaults fit MVP.

### 10.3 tsx

Run TS directly for scripts (seed data, eval harness, one-off ops). No build step.

### 10.4 ngrok (dev)

Expose localhost to Linq's webhook during development. Free tier sufficient. Vercel preview deploys are an alternative — slower feedback loop but no localhost tunnel.

### 10.5 Anthropic SDK

`@anthropic-ai/sdk`. Official, typed, maintained.

### 10.6 Zod

Schema validation for webhook payloads and tool-use outputs. Defend the boundary; trust nothing from the network.

---

## 11. Project structure

```
thread/
  app/
    api/
      linq/
        webhook/route.ts
      login/route.ts
    dashboard/
      layout.tsx
      page.tsx
      projects/
        [id]/
          page.tsx
          digest/page.tsx
        new/page.tsx
      unmapped/page.tsx
    login/page.tsx
    layout.tsx
  lib/
    airtable.ts          // adapter + typed schemas
    extract.ts           // Claude tool-use call
    prompts/
      extract.ts         // prompt builder
    digest.ts            // markdown rendering
    auth.ts              // session cookie helpers
    linq.ts              // HMAC verification + outbound client
    types.ts             // shared types
  scripts/
    seed.ts              // create seeded projects + participants
    replay.ts            // re-run extraction on a message id
    eval.ts              // run extraction on labeled corpus, report P/R
  tests/
    unit/
    integration/
  middleware.ts
  .env.example
  biome.json
  next.config.ts
  package.json
  pnpm-lock.yaml
  tsconfig.json
```

---

## 12. External services summary

| Service | Tier | Monthly cost at demo scale |
|---|---|---|
| Vercel | Hobby | $0 |
| Anthropic API | Pay-as-you-go | ~$10–30 at MVP volume |
| Airtable | Team ($10/user/mo) | $10 (Free may work for demo-only) |
| Linq | Sandbox (free) | $0 for demo |
| GitHub | Free | $0 |
| ngrok | Free (dev only) | $0 |
| **Total** | | **~$20–40** |

Post-demo, Linq transitions to a priced tier. Budget for a production deployment lands in the ~$150–300/month range depending on Linq line count and Anthropic volume.

---

## 13. Stack decisions explicitly deferred

These are v2+ problems. Noted so we don't re-decide.

- **Real database** — Postgres/Supabase when multi-tenancy or complex queries arrive.
- **Queue** — SQS, Inngest, or Trigger.dev when extraction volume or batch semantics demand it.
- **Real auth** — Clerk or Auth.js on multi-user.
- **Observability stack** — Sentry + Datadog/Axiom when Vercel logs aren't enough.
- **Frontend state library** — TanStack Query when we outgrow server components.
- **Mobile** — Expo / React Native when the operator asks.
- **Vision** — Claude with image inputs when we want to extract from swatch photos.

---

## 14. Stack principles (things to remember when adding)

Not inviolable rules; prompts for second-guessing.

- **Each new service is a failure mode.** Before adding one, ask if an existing piece can do the job.
- **Every decision should be reversible.** Prefer libraries/services with escape hatches (e.g., Airtable → export → Postgres path exists; Clerk → export → self-auth path exists). Avoid lock-in.
- **Optimize for the solo builder first.** If a choice would add 30 min to a single-developer PR for a 10% perf win, skip it.
- **Boring > clever.** This is a demo, not a platform. Interesting problems live in extraction quality and product design, not the stack.

---

## 15. Change log

- **0.1 (2026-04-21)** — Initial stack decisions for MVP. All MUST-level choices made.
