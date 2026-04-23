# Thread MVP Setup Guide

This guide walks through the full setup needed to get a functional Thread MVP running against your Linq sandbox.

It is written for the stack that exists in this repo today:

- Next.js 15 on Node.js
- Airtable as the only database
- Claude Sonnet 4.6 via Anthropic
- Linq Partner API v3 webhooks pinned to `2026-02-03`

For product and architecture context, start with:

- `docs/spec.md`
- `docs/PRD.md`
- `docs/SRS.md`
- `docs/SDD.md`
- `docs/TECH_STACK.md`

## 1. What “functional MVP” means

You are done when all of the following work:

1. The dashboard loads and you can log in.
2. Airtable passes schema verification.
3. Linq can deliver webhook events to `/api/linq/webhook`.
4. New inbound messages are stored in Airtable.
5. Mapped chats create reviewable `Items`.
6. You can generate and confirm a digest from the dashboard.

## 2. Prerequisites

Before starting, make sure you have:

- Node.js 20 or newer
- `pnpm`
- A Vercel account for the hosted MVP
- An Airtable workspace and a new base for Thread
- An Anthropic API key
- A Linq sandbox with:
  - an API key
  - a provisioned phone number
  - permission to create webhook subscriptions

The recommended path is:

1. Set up Airtable.
2. Configure local env vars.
3. Deploy to Vercel.
4. Register the Linq webhook subscription.
5. Seed demo data or connect a real sandbox chat.

## 3. Install the repo

```bash
pnpm install
```

Create your local env file:

```bash
cp .env.example .env.local
```

The repo’s standalone scripts read `.env.local` automatically, so you do not need to manually `export` variables before running commands like `pnpm verify:airtable` or `pnpm sync:webhook`.

Generate a strong session secret:

```bash
openssl rand -base64 32
```

Use that value for `SESSION_SECRET`.

## 4. Create the Airtable base

Create a new Airtable base and add these six tables exactly:

- `Projects`
- `Participants`
- `Messages`
- `Items`
- `DigestRuns`
- `Events`

Important: the app reads Airtable fields by exact name. Match the names below exactly, including capitalization and spaces.

### 4.1 Projects

| Field | Recommended Airtable type | Notes |
|---|---|---|
| `Name` | Single line text | Primary field |
| `Client Name` | Single line text | Used directly by the app |
| `Client` | Link to `Participants` | Optional at first, but create it |
| `Address` | Long text | Optional |
| `Budget` | Currency | Optional |
| `Phase` | Single select | `Lead`, `Design`, `Procurement`, `Install`, `Complete` |
| `Linq Chat IDs` | Long text | One chat ID per line |
| `Context Notes` | Long text | Extra context for extraction |
| `Status` | Single select | `Active`, `Paused`, `Archived` |
| `Last Activity` | Date with time | Updated by the app |

### 4.2 Participants

| Field | Recommended Airtable type | Notes |
|---|---|---|
| `Name` | Single line text | Primary field |
| `Phone` | Phone number | E.164 preferred |
| `Role` | Single select | `Client`, `Designer`, `Contractor`, `Vendor`, `Other` |
| `Projects` | Link to `Projects` | Many-to-many is fine |
| `Notes` | Long text | Optional |

### 4.3 Messages

| Field | Recommended Airtable type | Notes |
|---|---|---|
| `Linq Message ID` | Single line text | Primary field |
| `Chat ID` | Single line text | Linq chat identifier |
| `Project` | Link to `Projects` | Empty until chat is mapped |
| `Sender Handle` | Single line text | Phone or sender handle |
| `Sender Name` | Single line text | Optional |
| `Direction` | Single select | `inbound`, `outbound` |
| `Body` | Long text | Extracted text body |
| `Raw Parts` | Long text | JSON string |
| `Raw Attachments` | Long text | JSON string |
| `Reply To Message ID` | Single line text | Optional |
| `Service` | Single line text | Usually `iMessage` |
| `Is Group` | Checkbox | True for group chats |
| `Timestamp` | Date with time | Message timestamp |
| `Processed` | Checkbox | Set by processing pipeline |
| `Extraction Error` | Long text | Optional |
| `Webhook Event ID` | Single line text | Linq event id |

### 4.4 Items

| Field | Recommended Airtable type | Notes |
|---|---|---|
| `Summary` | Single line text | Primary field |
| `Project` | Link to `Projects` | Required for normal flow |
| `Source Message` | Link to `Messages` | Required |
| `Type` | Single select | `Decision`, `Action`, `Budget`, `Schedule`, `Product`, `Address`, `Question`, `Other` |
| `Details` | Long text | Optional |
| `Confidence` | Number | 0 to 1 |
| `Status` | Single select | `Pending`, `Accepted`, `Edited`, `Rejected`, `Synced` |
| `Owner` | Single select | `Designer`, `Client`, `Contractor`, `Vendor`, `Unknown` |
| `Due` | Date | Optional |
| `Reviewed At` | Date with time | Optional |
| `Synced At` | Date with time | Optional |

### 4.5 DigestRuns

| Field | Recommended Airtable type | Notes |
|---|---|---|
| `Project` | Link to `Projects` | Required |
| `Included Items` | Link to `Items` | Multiple records |
| `Digest Markdown` | Long text | Full rendered digest |
| `Confirmed Synced At` | Date with time | Optional |
| `Generated At` | Created time | Recommended |

### 4.6 Events

| Field | Recommended Airtable type | Notes |
|---|---|---|
| `Event ID` | Single line text | Primary field recommended |
| `Event Type` | Single line text | Linq event type |
| `Webhook Version` | Single line text | Should be `2026-02-03` |
| `Message ID` | Single line text | Optional by event type |
| `Chat ID` | Single line text | Optional by event type |
| `Trace ID` | Single line text | Optional |
| `Partner ID` | Single line text | Optional |
| `Status` | Single select | `Pending`, `Processed`, `Skipped`, `Duplicate`, `Failed` |
| `Processing Notes` | Long text | Optional |
| `Payload JSON` | Long text | Raw webhook body |

## 5. Create the Airtable PAT

Create an Airtable personal access token and give it:

- access to the Thread base
- record read/write access
- schema metadata read access

The schema metadata permission is required because `pnpm verify:airtable` reads the base schema through the Airtable metadata API.

## 6. Fill in environment variables

Set the same values locally in `.env.local` and in Vercel project env vars.

### 6.1 Required values

| Variable | What it should contain |
|---|---|
| `AIRTABLE_BASE_ID` | Your Airtable base id |
| `AIRTABLE_PAT` | Your Airtable PAT |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `ANTHROPIC_MODEL` | Leave as `claude-sonnet-4-6` unless you intentionally change it |
| `BASE_URL` | Public HTTPS URL for the app |
| `DASHBOARD_PASSWORD` | Shared password used for `/login` |
| `LINQ_API_KEY` | Linq sandbox API key |
| `LINQ_PHONE_NUMBER` | The Linq-provisioned phone number tied to the webhook subscription |
| `SESSION_SECRET` | Random secret for signing the session cookie |

### 6.2 Values you can leave blank on first pass

| Variable | When to fill it |
|---|---|
| `LINQ_WEBHOOK_SECRET` | After the first successful `pnpm sync:webhook` creation |
| `LINQ_WEBHOOK_SUBSCRIPTION_ID` | After the first successful `pnpm sync:webhook` creation |

### 6.3 `BASE_URL` examples

- Hosted Vercel deployment: `https://your-thread-app.vercel.app`
- Local tunnel: `https://your-subdomain.ngrok.app`

Use a public HTTPS URL that Linq can reach.

## 7. Verify Airtable before wiring Linq

Once `.env.local` has `AIRTABLE_BASE_ID` and `AIRTABLE_PAT`, run:

```bash
pnpm verify:airtable
```

Expected success output:

```text
Airtable schema looks good.
```

If it reports missing fields, fix the Airtable base first. The rest of the app assumes the schema is already correct.

## 8. Deploy the app

Recommended MVP path: deploy to Vercel first, then point Linq at the deployed webhook URL.

### 8.1 Vercel setup

1. Import the repo into Vercel.
2. Add all environment variables from section 6.
3. Deploy.
4. Confirm the app loads at `BASE_URL`.

Until `LINQ_WEBHOOK_SECRET` is set, the webhook route will return `503`. That is expected during first-time setup.

### 8.2 Local development option

If you want to test locally:

1. Run `pnpm dev`
2. Expose the app with a public HTTPS tunnel
3. Set `BASE_URL` to that tunnel URL
4. Run `pnpm sync:webhook`

For a first functional MVP, hosted Vercel is simpler and more reliable.

## 9. Create the Linq webhook subscription

Run:

```bash
pnpm sync:webhook
```

This script creates or updates a webhook subscription pointed at:

```text
<BASE_URL>/api/linq/webhook?version=2026-02-03
```

It subscribes to:

- `message.received`
- `reaction.added`
- `reaction.removed`
- `participant.added`
- `participant.removed`
- `chat.created`

### 9.1 First-time creation

On the first run, Linq should return a new subscription payload. Save these values:

- the subscription `id` into `LINQ_WEBHOOK_SUBSCRIPTION_ID`
- the returned `signing_secret` into `LINQ_WEBHOOK_SECRET`

Then:

1. update `.env.local`
2. update the Vercel project env vars
3. redeploy Vercel or restart local dev

After that, webhook verification is live.

### 9.2 Later updates

Once `LINQ_WEBHOOK_SUBSCRIPTION_ID` is set, `pnpm sync:webhook` updates the existing subscription in place.

## 10. Log into the dashboard

Visit:

```text
<BASE_URL>/login
```

Use the `DASHBOARD_PASSWORD` value you configured.

If the app is up and Airtable is reachable, you should land on `/dashboard`.

## 11. Choose your initial data path

You have two good options.

### 11.1 Option A: Seed a demo state

Run:

```bash
pnpm seed
```

This creates:

- two demo projects
- linked demo chats
- demo messages
- demo items ready for review

This is the fastest way to confirm the dashboard, review flows, and digest generation are working.

### 11.2 Option B: Start with live sandbox traffic

Skip seeding and use the Linq sandbox directly:

1. Add the Linq number to a real or sandbox iMessage group chat.
2. Send a message into that group.
3. Open `/dashboard/unmapped`.
4. Bind the new chat to an existing project.
5. Send another substantive inbound message.

The second message should be processed into `Items` once the chat is mapped.

## 12. Functional smoke test

Run through this checklist after setup.

### 12.1 Dashboard and auth

- `/login` accepts your password
- `/dashboard` loads
- projects render without Airtable errors

### 12.2 Airtable write path

- `pnpm seed` succeeds or a live webhook creates rows in `Events` and `Messages`
- an unmapped chat appears in `/dashboard/unmapped`
- binding the chat updates the project’s `Linq Chat IDs`

### 12.3 Extraction path

Send a substantive inbound message like:

> Approved the sofa. Please send the lamp pricing by Friday and move install to next Tuesday morning.

Then verify:

- a `Messages` row was created
- the message is marked processed
- one or more `Items` rows were created
- the project detail page shows the extracted items

### 12.4 Digest path

1. Accept or edit a few items.
2. Open the project digest page.
3. Generate a digest.
4. Use the copy button.
5. Click `Mark synced`.

Then confirm the included items move to `Synced` and drop out of the main active review queue.

## 13. Useful commands during setup

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

## 14. Troubleshooting

### `pnpm verify:airtable` fails

Most likely causes:

- a table name does not match exactly
- a field name does not match exactly
- the Airtable PAT does not have schema metadata access
- the PAT is not scoped to the correct base

### Webhooks return `503`

`LINQ_WEBHOOK_SECRET` is still unset in the running environment. Add the real signing secret returned by Linq, then redeploy or restart.

### Webhooks return `401`

Signature verification is failing. Usually this means:

- `LINQ_WEBHOOK_SECRET` is wrong
- the webhook subscription points to a different environment than the one whose secret you configured
- Linq is sending to an old `BASE_URL`

### Events arrive but no items are created

Check these in order:

1. The event type is audit-only (`reaction.*`, `participant.*`, `chat.created`)
2. The message came from the agent’s own phone number and was skipped
3. The chat is still unmapped
4. The message was chit-chat and extraction correctly emitted nothing
5. The `Messages` row has an `Extraction Error`

### A new project chat appears after adding or removing participants

That is expected with iMessage group chat behavior. Bind the new `chat_id` to the same project from `/dashboard/unmapped`.

## 15. Recommended first real demo flow

Once the stack is wired up:

1. Seed the demo with `pnpm seed`
2. Confirm review and digest flows in the UI
3. Add the Linq number to a sandbox group chat
4. Send a real inbound message
5. Bind the chat if needed
6. Send a second message with a clear decision or action item
7. Show the extracted item appear in the dashboard
8. Generate a digest and mark it synced

That gives you a complete, working MVP loop with both seeded and live proof.
