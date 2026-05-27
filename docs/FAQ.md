# Sparko FAQ

## What is Sparko?

Sparko helps builders, founders, PMs, developers, designers, and investors turn X into a channel for personal branding, founder-led growth, team-led growth, and building in public. It turns account identity, company context, weekly inputs, and post briefs into draft options you can review, edit, schedule, and publish with human approval in the loop.

## Is Sparko affiliated with X?

No. Sparko is independent and is not affiliated with, endorsed by, or sponsored by X Corp.

## Can I try it without connecting a real X account?

Yes. Run:

```bash
npm install
npm run demo
```

The seeded `Example Studio` data is fictional and safe for local exploration.

## Does the demo publish anything?

No. The demo data is fictional. Real publishing requires your own X Developer app, connected X account, database, Redis queue, and worker process.

## Which AI providers are supported?

Sparko supports OpenAI, xAI/Grok, and Anthropic/Claude through the `DRAFT_AI_PROVIDER` setting. Only the selected provider needs an API key. You can also adapt the provider layer for another compatible LLM API.

## Do I need an AI provider key for setup?

You can explore the seeded demo UI without live generation. Draft generation, context extraction, and prompt creation require the selected provider key.

## Where are OAuth tokens stored?

Tokens are stored in your own database. Never commit `.env`, database dumps, logs, screenshots containing secrets, or token values.

## What makes Sparko different from a normal scheduler?

Sparko focuses on the work before scheduling: account identity, company context, weekly inputs, draft options, review, approval, and publishing guardrails. The goal is not just to fill a calendar; it is to help each account build a recognizable voice and a reason to follow.

## What makes Sparko different from asking an AI chatbot for posts?

Sparko keeps reusable account and company context in the workflow, supports multiple account roles, stores draft state, and keeps human review before scheduling. It is designed around repeatable inputs and role-aware drafting, not one-off prompts.

## Can contributors add new post templates?

Yes. Role-specific input templates are a good contribution area. Keep examples specific, useful, and grounded in fictional demo data.

## Can I use real customer examples in docs or tests?

No. Use fictional data only. Public examples should not include real handles, user ids, post ids, customer names, private URLs, credentials, or company information.

## Where should I start contributing?

Read [CONTRIBUTING.md](../CONTRIBUTING.md), then browse [GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md). Look for work labeled `good first issue` or `help wanted`.
