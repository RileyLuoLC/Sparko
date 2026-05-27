# Sparko

Sparko helps builders, founders, PMs, developers, designers, and investors turn X into a channel for personal branding, founder-led growth, team-led growth, and building in public.

Most builders know they should post more. The hard part is knowing what to say every day: what will attract the right audience, carry a real point of view, and still give readers something useful. Sparko turns account identity, company context, weekly inputs, and post briefs into draft options you can review, edit, schedule, and publish with human approval in the loop.

The drafting workflow is designed around formats and structures that tend to perform well on X, so rough notes, weekly updates, and company context can become posts that feel native to the feed. The goal is to find the perfect balance between publishing authentic, organic, useful posts that fit your role, attract the audience you want, and compound into a profile worth following - while creating content that sparks discussion, earns engagement, gets reposted, and spreads on X.

Star Sparko if you're building your brand, audience, or distribution on X.

## How Sparko Is Different from Other Tools

Many X posting tools start from the market: they show high-performing posts, which you can save and imitate.

That can be useful for learning formats, but it is hard to turn into authentic growth. A line that works for a large creator, a famous founder, or a specific operator often works because of who said it, what they have lived through, and why their audience already trusts them. If your account only repeats what performed for someone else, it becomes harder to build a recognizable voice, a reason to follow, or a reason for the right people to start conversations with you.

Sparko works in the opposite direction. It starts from your identity, your company, your weekly reality, and the outcome you want: founder-led growth, team-led growth, personal branding, or building in public. Market signals can still inform what kinds of posts tend to work for people in a similar role, but the final draft is meant to sound like something you or your team could actually say.

## What You Provide

- Connected X accounts through your own X Developer app.
- Account identity: role, tone, audience, content pillars, and optional guardrails.
- Company information: product, positioning, industry, competitive advantage, and other context worth using.
- Weekly inputs: what you learned, shipped, noticed, struggled with, or heard from customers this week.
- Optional post briefs when you already know the angle you want to explore.

## What Sparko Produces

- Draft options shaped around your account identity and current context.
- Role-based templates that collect better inputs from you.
- Review queue drafts that can be edited before approval.
- Scheduled posts that publish through your connected X account.
- A lightweight workflow for keeping founder-led or team-led posting consistent without turning the account into a copy of someone else's voice.

## Before / After

| Raw input | Sparko-style draft |
| --- | --- |
| We shipped approval before scheduling. | The best AI workflow feature we shipped this week was not generation. It was the pause before publishing. Teams trust automation faster when the system knows where human judgment belongs. |
| Customer said they do not want another content calendar. | A lot of teams do not have a posting problem. They have a context problem. The calendar is empty because nobody has turned the week's real work into clear points of view yet. |
| Founder wants to talk about why copying viral posts fails. | Copying a viral post often copies the surface area and misses the reason it worked. Voice, timing, scars, audience trust - those are the parts that do not fit in a template. |
| Engineer fixed queue fallback for overdue posts. | The boring part of scheduled publishing matters most: what happens when a job is missed, delayed, retried, or needs a clear audit trail. Reliability is a content feature when the workflow touches a real account. |
| Team learned that product posts perform better with concrete examples. | Product posts get sharper when they stop saying "workflow" and start showing the moment a user recognizes themselves. Specific beats polished almost every time. |

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

Only the selected AI provider needs a key. Replace model names with models available to your provider account.

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

Star Sparko if you want the open-source playbook for turning raw ideas, weekly inputs, and company context into high-performing X posts.
