# GrandX Project Context

Last updated: 2026-05-26

## Product Direction

GrandX is an open-source X publishing console for people and teams who want AI-assisted drafting without losing human review, account context, and scheduled publishing control.

Each installation should use the operator's own X Developer app, X accounts, API keys, Postgres database, and Redis queue.

## Current Implementation

GrandX is a Next.js + TypeScript app with:

- App Router dashboard UI
- Prisma schema for Postgres
- Redis/BullMQ worker for scheduled publishing
- OpenAI and optional xAI draft generation adapters
- X OAuth/API adapter
- Fictional Example Studio demo data
- Vitest coverage for policy and demo-store behavior

## Core Workflows

1. Connect one or more X accounts through OAuth.
2. Fill Account Info and Company Info.
3. Collect weekly inputs or write a post brief.
4. Generate draft candidates.
5. Keep drafts into Review Queue.
6. Approve and schedule posts.
7. Keep the worker running so scheduled posts publish at the selected time.

## Safety Defaults

- Drafts must be approved before scheduling.
- Edited approved drafts return to review before scheduling.
- Duplicate or near-duplicate posts are blocked inside the configured safety window.
- Same-account posts require a configurable interval between scheduled times.
- Scheduled publishing uses the X API with OAuth user context, not browser automation.
- No automatic likes, follows, or unsolicited reply automation are implemented.

## Key Files

- `README.md` - open-source setup and workflow summary
- `src/components/dashboard-shell.tsx` - main dashboard UI
- `src/lib/demo-store.ts` - fictional demo mode data and workflow mutations
- `src/lib/policy.ts` - post, scheduling, duplicate, and interaction policy guards
- `src/lib/openai.ts` - OpenAI draft generation adapter
- `src/lib/x-api.ts` - X OAuth/API adapter
- `worker/index.ts` - BullMQ worker for scheduled publishing and metrics sync
- `prisma/schema.prisma` - database models
- `tests/policy.test.ts` - policy coverage

## Local Commands

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Run the worker separately:

```bash
npm run worker
```

Verification:

```bash
npm run typecheck
npm test
npm run build
```

## Open Source Hygiene

- Do not commit `.env`, `.env.local`, database dumps, logs, `.next/`, or `node_modules/`.
- Demo data must remain fictional and use Example Studio style names.
- Do not add real X handles, user ids, post ids, OAuth tokens, API keys, or screenshots containing secrets.
- `prisma/migrations` should be committed so fresh installs can migrate predictably.
