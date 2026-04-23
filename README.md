# Thread

Thread is a Next.js MVP for an iMessage context agent built around the Linq Blue API. It receives Linq webhooks, stores normalized project memory in Airtable, uses Claude to extract reviewable items from inbound messages, and gives the operator a small dashboard for review and digest generation.

## Setup Guide

For the full end-to-end MVP runbook, see [`docs/SETUP.md`](docs/SETUP.md).

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS 4
- Airtable as the only persistence layer
- Claude Sonnet 4.6 via the Anthropic SDK
- Linq Partner API v3, pinned to webhook payload version `2026-02-03`

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `BASE_URL`
- `SESSION_SECRET`
- `DASHBOARD_PASSWORD`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_PAT`
- `ANTHROPIC_API_KEY`
- `LINQ_API_KEY`
- `LINQ_PHONE_NUMBER`
- `LINQ_WEBHOOK_SECRET`

`ANTHROPIC_MODEL` defaults to `claude-sonnet-4-6`.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:airtable
pnpm sync:webhook
pnpm seed
pnpm replay <linq-message-id>
pnpm eval
```

## Airtable Schema

The app expects six tables:

- `Projects`
- `Participants`
- `Messages`
- `Items`
- `DigestRuns`
- `Events`

Run `pnpm verify:airtable` after provisioning the base to confirm the required fields are present.

## Webhook Setup

`pnpm sync:webhook` creates or updates a Linq webhook subscription pointed at:

`<BASE_URL>/api/linq/webhook?version=2026-02-03`

When creating a new subscription, Linq returns the signing secret once. Save that value into `LINQ_WEBHOOK_SECRET`.

## Demo Seed

`pnpm seed` creates two demo projects, binds seeded chat IDs, stores sample messages, and populates a small review queue so the dashboard is not empty on first launch.
