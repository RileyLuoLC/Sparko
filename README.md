# GrandX

GrandX is an open-source console for drafting, reviewing, scheduling, and publishing X posts with human approval in the loop.

Each installation uses the operator's own X Developer app, X accounts, API keys, database, and Redis queue. The repository ships with fictional `Example Studio` demo data only.

## Quick Start

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

Run the worker in a second terminal so scheduled posts can publish at their scheduled time:

```bash
npm run worker
```

## Environment

Fill `.env.local` with your own credentials:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://xposter:xposter@localhost:5432/xposter?schema=public
REDIS_URL=redis://localhost:6379

X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=http://localhost:3000/api/x/oauth/callback
X_BEARER_TOKEN=

# Pick one AI provider: openai, xai, or claude
DRAFT_AI_PROVIDER=openai

OPENAI_API_KEY=
OPENAI_DRAFT_MODEL=gpt-5-mini
OPENAI_STRATEGY_MODEL=gpt-5.1

XAI_API_KEY=
XAI_BASE_URL=https://api.x.ai/v1
XAI_DRAFT_MODEL=grok-4.3
XAI_STRATEGY_MODEL=grok-4.3

ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_DRAFT_MODEL=claude-sonnet-4-20250514
ANTHROPIC_STRATEGY_MODEL=claude-sonnet-4-20250514
```

Do not commit `.env`, `.env.local`, database dumps, logs, screenshots with tokens, or generated build output.

## AI Provider Setup

GrandX can use OpenAI, xAI/Grok, or Anthropic/Claude for draft generation, account input prompts, and company context extraction.

Set `DRAFT_AI_PROVIDER` to one of:

- `openai`: fill `OPENAI_API_KEY`, `OPENAI_DRAFT_MODEL`, and `OPENAI_STRATEGY_MODEL`
- `xai`: fill `XAI_API_KEY`, `XAI_BASE_URL`, `XAI_DRAFT_MODEL`, and `XAI_STRATEGY_MODEL`
- `claude`: fill `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_DRAFT_MODEL`, and `ANTHROPIC_STRATEGY_MODEL`

Only the selected provider needs a key. The model values in `.env.example` are examples; replace them with models available to your own provider account.

These AI provider keys are separate from X API keys. X OAuth controls account connection and publishing. The AI provider controls drafting and context extraction.

## X Developer App Setup

Create an app in the X Developer Portal and configure it for the account that will run this local instance.

- App type: `Web App, Automated App or Bot`
- App permissions: `Read and write`
- OAuth 2.0 callback URL: `http://localhost:3000/api/x/oauth/callback`
- OAuth scopes used by GrandX: `tweet.read tweet.write users.read offline.access`

After the app is configured, start GrandX and click `Connect X` / `Add Another X Account`. Each user connects their own X account through OAuth; do not paste personal user tokens into source files.

`X_BEARER_TOKEN` is optional and only used for read-only discovery/search style features. Publishing uses the OAuth user token stored in your own database after Connect X.

## Database and Demo Data

`npm run prisma:seed` creates fictional `Example Studio` records so the UI is understandable on first launch. The demo records are not real companies, accounts, posts, or X URLs.

To reset local data before publishing your own fork or before sharing a clean demo:

```bash
docker compose down -v
docker compose up -d
npm run prisma:migrate
npm run prisma:seed
```

This deletes local Postgres data, including connected X accounts, OAuth tokens, scheduled posts, published posts, metrics, and audit logs.

If you want a clean demo database while keeping your existing local data, run a separate clean stack on different ports:

```bash
docker compose -p grandx-clean -f docker-compose.clean.yml up -d
DATABASE_URL="postgresql://xposter:xposter@localhost:55432/xposter?schema=public" npm run prisma:migrate
DATABASE_URL="postgresql://xposter:xposter@localhost:55432/xposter?schema=public" npm run prisma:seed
```

Then start GrandX against the clean stack:

```bash
DATABASE_URL="postgresql://xposter:xposter@localhost:55432/xposter?schema=public" \
REDIS_URL="redis://localhost:56379" \
npm run dev
```

In another terminal, run the clean worker:

```bash
DATABASE_URL="postgresql://xposter:xposter@localhost:55432/xposter?schema=public" \
REDIS_URL="redis://localhost:56379" \
npm run worker
```

This does not touch the default `docker-compose.yml` volumes or the data behind `localhost:5432`.

## Workflow

1. Connect one or more X accounts with OAuth.
2. Fill Account Info and Company Info.
3. Add weekly inputs or write a post brief.
4. Generate draft options.
5. Keep drafts into Review Queue.
6. Approve, schedule, reschedule, or cancel posts.
7. Keep the worker running for real scheduled publishing.

## Safety Defaults

- Drafts require approval before scheduling.
- Scheduled posts are published by the worker, not by browser automation.
- The worker scans for overdue queued posts as a fallback if a queue job is missed.
- OAuth tokens are stored in your own database and must never be committed.
- Demo mode uses fictional data and does not publish to X.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Before creating the first public commit, run a local audit:

```bash
rg -n "OPENAI_API_KEY=sk-|XAI_API_KEY=.+|ANTHROPIC_API_KEY=.+|X_CLIENT_SECRET=.+|X_BEARER_TOKEN=.+|access_token|refresh_token" --glob '!node_modules/**' --glob '!.next/**'
```

Expected results should be code identifiers or empty example placeholders only, never real token values or real account/post records. Also run the same search with any real handles, user ids, and post ids you used locally before creating a public commit.
