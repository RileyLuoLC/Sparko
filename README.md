# GrandX

GrandX is an open-source console for builders, founders, and teams shaping their presence on X through personal branding, founder-led growth, team-led growth, and building in public.

Most builders know they should post more. The hard part is knowing what to say every day: what will attract the right audience, carry a real point of view, and still give readers something useful. GrandX turns account identity, company context, weekly inputs, and post briefs into draft options you can review, edit, schedule, and publish with human approval in the loop.

The drafting workflow is designed around formats and structures that tend to perform well on X, so rough notes, weekly updates, and company context can become posts that feel native to the feed.

It is built for founders, product teams, growth teams, creators, and operators who want their X presence to sound like a thinking person or team, not a generic content machine. The goal is to help you publish authentic, organic, useful posts that fit your role, attract the audience you want, and compound into a profile worth following.

Each installation uses the operator's own X Developer app, X accounts, API keys, database, and Redis queue. The repository ships with fictional `Example Studio` demo data only.

## How GrandX Is Different from Other Tools

Many X posting tools start from the market: they show high-performing posts, which you can save and imitate.

That can be useful for learning formats, but it is hard to turn into authentic growth. A line that works for a large creator, a famous founder, or a specific operator often works because of who said it, what they have lived through, and why their audience already trusts them. If your account only repeats what performed for someone else, it becomes harder to build a recognizable voice, a reason to follow, or a reason for the right people to start conversations with you.

GrandX works in the opposite direction. It starts from your identity, your company, your weekly reality, and the outcome you want: founder-led growth, team-led growth, personal branding, or building in public. Market signals can still inform what kinds of posts tend to work for people in a similar role, but the final draft is meant to sound like something you or your team could actually say.

## What You Provide

- Connected X accounts through your own X Developer app.
- Account identity: role, tone, audience, content pillars, and optional guardrails.
- Company information: product, positioning, industry, competitive advantage, and other context worth using.
- Weekly inputs: what you learned, shipped, noticed, struggled with, or heard from customers this week.
- Optional post briefs when you already know the angle you want to explore.

## What GrandX Produces

- Draft options shaped around your account identity and current context.
- Role-based templates that collect better inputs from you.
- Review queue drafts that can be edited before approval.
- Scheduled posts that publish through your connected X account.
- A lightweight workflow for keeping founder-led or team-led posting consistent without turning the account into a copy of someone else's voice.

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

Different models write very differently. Try a few providers and models until you find the voice that fits your account. Smaller or cheaper models may be fine for structured extraction and template generation, while stronger writing models usually do better at opinionated, insightful, audience-aware posts.

At the time of release, the builder's favorite writing model is `gpt-5.5` because it tends to articulate sharper opinions and more thoughtful post angles. It may cost more than smaller models, so check your provider's current pricing and usage limits before making it your default.

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
