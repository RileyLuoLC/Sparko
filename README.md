# Sparko

Open-source X growth assistant for founders, builders, and teams.

Turn account identity, company context, weekly inputs, post briefs, and interaction opportunities into X posts and relationship-building actions you can review, edit, schedule, and publish — with human approval in the loop.

⭐ Star Sparko if you’re building your brand, audience, or distribution on X.

Most builders know they should post more. The hard part is knowing what to say every day: what will attract the right audience, carry a real point of view, and still give readers something useful.

Sparko helps turn messy day-to-day context into a repeatable growth workflow for personal branding, founder-led growth, team-led growth, and building in public — combining consistent publishing with timely interactions that deepen relationships on X.

## Why Sparko

The drafting workflow is designed around formats and structures that tend to perform well on X, so rough notes, weekly updates, and company context can become posts that feel native to the feed.

The goal is to find the perfect balance between publishing authentic, organic, useful posts that fit your role, attract the audience you want, and compound into a profile worth following — while creating content that sparks discussion, earns engagement, gets reposted, and spreads on X.

But growth on X is not only about posting. It also comes from showing up in the right conversations, replying with substance, and staying meaningfully engaged with people who matter to your work, audience, and network.

Sparko generates timely interaction suggestions on who to reply to, what to engage with, and how to keep conversations going — so your X presence compounds not just into reach, but into real relationships.

## Before & After

| Before | After |
| --- | --- |
| I launched Sparko to help builders, founders, growth marketers, investors, developers, and investors get better at growth and personal branding on X. | Attention is getting more personal, not less.<br><br>Sparko is my bet that growth on X won’t be won by louder brands, but by sharper characters: founders, PMs, engineers, marketers, designers, creators with something real to say. |
| (Input Sparko's context) | The next growth channel is not another company account with polished launch copy.<br><br>It is the people inside the product explaining what they see, what they tried, what broke, and what they learned.<br><br>The hard part is helping them write without sanding off the person. |

## The Workflow

1. Define your account identity
2. Add company context
3. Collect weekly inputs
4. Generate draft options
5. Review, edit, approve
6. Schedule and publish
7. Get interaction suggestions
8. Keep conversations going

## Quick Start

Requirements:

- Node.js 20+
- npm
- Docker Desktop or a Docker-compatible runtime
- An X Developer app if you want to connect and publish through real X accounts
- An OpenAI, xAI, Anthropic, or other compatible LLM API key if you want live AI generation

Install dependencies and start the full local demo:

```bash
npm install
npm run demo
```

`npm run demo` prepares `.env.local` if it does not exist, starts Postgres and Redis through Docker Compose, generates Prisma client code, applies migrations, seeds fictional `Example Studio` data, then runs the Next.js app and scheduled publishing worker.

Open `http://localhost:3000`.

Stop the demo with `Ctrl+C`.

## Manual Setup

Use these commands when you want more control than `npm run demo`:

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Run the worker in a second terminal:

```bash
npm run worker
```

## Environment

Fill `.env.local` with credentials for the services you actually use.

Core local defaults:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://xposter:xposter@localhost:5432/xposter?schema=public
REDIS_URL=redis://localhost:6379
```

X publishing:

```env
X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=http://localhost:3000/api/x/oauth/callback
X_BEARER_TOKEN=
```

AI drafting:

```env
DRAFT_AI_PROVIDER=openai
REPLY_AI_PROVIDER=
OPENAI_API_KEY=
OPENAI_DRAFT_MODEL=gpt-5-mini
OPENAI_REPLY_MODEL=gpt-5-mini
OPENAI_STRATEGY_MODEL=gpt-5.1

XAI_API_KEY=
XAI_BASE_URL=https://api.x.ai/v1
XAI_DRAFT_MODEL=grok-4.3
XAI_REPLY_MODEL=grok-4.3
XAI_STRATEGY_MODEL=grok-4.3

ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_DRAFT_MODEL=claude-sonnet-4-20250514
ANTHROPIC_REPLY_MODEL=claude-sonnet-4-20250514
ANTHROPIC_STRATEGY_MODEL=claude-sonnet-4-20250514
```

Only the selected AI provider needs a key. Replace model names with models available to your provider account. Leave `REPLY_AI_PROVIDER` blank to use local reply templates; set it to `openai`, `xai`, or `claude` to use a separate reply model.

Do not commit `.env`, `.env.local`, database dumps, logs, screenshots with tokens, or generated build output.

## X Developer App Setup

Create an app in the X Developer Portal and configure it for the account that will run your local Sparko instance.

- App type: `Web App, Automated App or Bot`
- App permissions: `Read and write`
- OAuth 2.0 callback URL: `http://localhost:3000/api/x/oauth/callback`
- OAuth scopes used by Sparko: `tweet.read tweet.write users.read offline.access`

After the app is configured, start Sparko and click `Connect X` or `Add Another X Account`. Each user connects their own X account through OAuth.

`X_BEARER_TOKEN` is optional and only used for read-only discovery/search style features. Publishing uses the OAuth user token stored in your own database after Connect X.

## Workflow

1. Connect one or more X accounts with OAuth.
2. Fill Account Info and Company Info.
3. Add weekly inputs or write a post brief.
4. Generate draft options.
5. Keep drafts into the Review Queue.
6. Approve, schedule, reschedule, or cancel posts.
7. Keep the worker running for scheduled publishing.

## Safety Defaults

- Drafts require approval before scheduling.
- Edited approved drafts return to review before scheduling.
- Scheduled posts are published by the worker, not by browser automation.
- The worker scans for overdue queued posts as a fallback if a queue job is missed.
- OAuth tokens are stored in your own database and must never be committed.
- Demo data is fictional and does not represent real companies, accounts, posts, or X URLs.

## Contributing

Contributions are welcome, especially focused improvements to setup, documentation, role-specific templates, demo data, and the review/scheduling workflow.

- Read [CONTRIBUTING.md](CONTRIBUTING.md).
- Browse [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md).
- Read [SECURITY.md](SECURITY.md) before reporting vulnerabilities.
- Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Useful labels for maintainers:

- `good first issue`
- `help wanted`
- `bug`
- `feature`
- `documentation`
- `question`

## FAQ

See [docs/FAQ.md](docs/FAQ.md).

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Before publishing a fork or public screenshot, run a local audit:

```bash
rg -n "OPENAI_API_KEY=sk-|XAI_API_KEY=.+|ANTHROPIC_API_KEY=.+|X_CLIENT_SECRET=.+|X_BEARER_TOKEN=.+|access_token|refresh_token" --glob '!node_modules/**' --glob '!.next/**'
```

Expected results should be code identifiers or empty example placeholders only, never real token values or real account/post records. Also search for any real handles, user ids, and post ids you used locally.

## GitHub Launch Checklist

Repository description:

```text
Open-source X growth console for founder-led growth, team-led growth, and building in public.
```

Recommended topics:

```text
twitter, social-media, content-creation, personal-branding, founder-led-growth, team-led-growth, growth-marketing, build-in-public, open-source, nextjs, typescript, llm, prisma
```

Recommended Discussions categories:

- Showcase posts
- Contributor help
- Release announcements
- Ideas and votes

## License

Sparko is released under the [MIT License](LICENSE).

Sparko is independent and is not affiliated with, endorsed by, or sponsored by X Corp.

⭐ Star Sparko if you want the open-source playbook for turning raw ideas, weekly inputs, and company context into a profile worth following on X.
