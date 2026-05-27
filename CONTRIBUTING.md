# Contributing to Sparko

Thanks for your interest in improving Sparko.

Sparko is built for builders, founders, and teams who want to create authentic, useful X posts from their own identity, company context, and weekly inputs. Contributions should preserve that direction: help users sound more like themselves, not like a generic content machine.

## Good First Places to Help

- Improve setup docs and error messages.
- Add focused tests for approval, scheduling, and policy behavior.
- Add role-specific input templates for founders, product teams, engineers, designers, growth teams, and company accounts.
- Improve fictional demo data and examples.
- Make the dashboard clearer without adding unnecessary complexity.

See [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md) for ready-to-copy starter issues.

## Local Setup

Fast path:

```bash
npm install
npm run demo
```

Manual path:

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

Open `http://localhost:3000`.

## Repository Map

- `app/` - Next.js App Router pages and API routes.
- `src/components/dashboard-shell.tsx` - main dashboard UI.
- `src/lib/demo-store.ts` - fictional in-memory demo data and workflow mutations.
- `src/lib/prisma-store.ts` - Postgres-backed workflow mutations.
- `src/lib/policy.ts` - post, scheduling, duplicate, and interaction policy guards.
- `src/lib/openai.ts` - AI provider adapters for draft generation and context extraction.
- `src/lib/x-api.ts` - X OAuth and API adapter.
- `worker/index.ts` - BullMQ worker for scheduled publishing and metrics sync.
- `prisma/schema.prisma` - database models.
- `tests/` - Vitest coverage.
- `docs/` - FAQ, project context, and contributor materials.

## Development Checks

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

If you change scheduling, publishing, approval, duplicate detection, policy logic, or data transformations, add or update focused tests.

## Pull Request Guidelines

- Keep changes focused and easy to review.
- Follow the existing TypeScript, React, Next.js, and Prisma patterns in the repo.
- Include screenshots for visible UI changes when useful.
- Include tests for behavior that touches policy, scheduling, publishing, or data transformations.
- Mention any setup, migration, or environment changes in the pull request.
- Do not rewrite unrelated files or reformat broad areas of the repo as part of a narrow fix.

## Demo Data Rules

Sparko should remain safe to publish and fork.

- Use fictional demo data only.
- Prefer names like `Example Studio`, `demo_company`, and `demo_personal`.
- Do not include real X handles, user ids, post ids, OAuth tokens, API keys, company information, customer data, or private URLs in fixtures, tests, screenshots, docs, or code comments.
- Do not commit `.env`, `.env.local`, `.next/`, `node_modules/`, logs, database dumps, or generated local artifacts.
- Before sharing screenshots, make sure they show fictional data and no browser extensions or secrets.

## Product Direction

Sparko should help users:

- define account identity before drafting
- collect better weekly inputs
- turn rough inputs into X-native drafts
- review and edit before publishing
- schedule and publish through their own connected X accounts

Avoid features that push users toward blindly copying high-performing posts from other accounts. Market signals can help, but the final output should fit the user's own role, audience, and goals.

## Issue Guidelines

Good issues are small and specific. For beginner-friendly work, include:

- expected behavior
- likely files
- difficulty
- acceptance criteria
- screenshots or examples when relevant

Example:

```md
Title: Add a visible app version to the footer

Expected:
The dashboard footer shows the current package version from package.json.

Files:
src/components/dashboard-shell.tsx
package.json

Difficulty:
Beginner
```

## Security

Please read [SECURITY.md](SECURITY.md) before contributing. If you discover a vulnerability, report it privately instead of posting exploit details in a public issue.

## Community

Please follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be direct, kind, and practical. The goal is to help more people ship useful, authentic X workflows without leaking secrets or automating away human judgment.
