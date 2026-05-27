# Contributing to GrandX

Thanks for your interest in improving GrandX.

GrandX is built for builders, founders, and teams who want to create authentic, useful X posts from their own identity, company context, and weekly inputs. Contributions should preserve that direction: help users sound more like themselves, not like a generic content machine.

## Local Setup

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Run the worker in another terminal:

```bash
npm run worker
```

## Development Checks

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

## Pull Request Guidelines

- Keep changes focused and easy to review.
- Follow the existing TypeScript, React, and Prisma patterns in the repo.
- Include tests for behavior that touches policy, scheduling, publishing, or data transformations.
- Do not commit `.env`, `.env.local`, `.next/`, `node_modules/`, logs, database dumps, or generated local artifacts.
- Do not include real X accounts, OAuth tokens, post ids, private company information, or real API keys in fixtures, tests, screenshots, or docs.
- Use fictional demo data. Prefer names like `Example Studio`, `demo_company`, and `demo_personal`.

## Product Direction

GrandX should help users:

- define account identity before drafting
- collect better weekly inputs
- turn rough inputs into X-native drafts
- review and edit before publishing
- schedule and publish through their own connected X accounts

Avoid features that push users toward blindly copying high-performing posts from other accounts. Market signals can help, but the final output should fit the user's own role, audience, and goals.

## Security

Please read `SECURITY.md` before contributing. If you discover a vulnerability, report it privately instead of posting exploit details in a public issue.
