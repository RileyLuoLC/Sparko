# Good First Issues

These issues are ready to copy into GitHub. Keep them small, specific, and friendly for new contributors.

## 1. Add an app version display

Expected:
Show the current package version in a low-visibility footer or settings area.

Files:
`src/components/dashboard-shell.tsx`, `package.json`

Difficulty:
Beginner

Acceptance criteria:
The visible version matches `package.json` and does not distract from the dashboard.

## 2. Add a clearer empty state for weekly inputs

Expected:
When there are no weekly inputs, show a concise prompt that tells the user what kind of update to add.

Files:
`src/components/dashboard-shell.tsx`, `src/lib/demo-store.ts`

Difficulty:
Beginner

Acceptance criteria:
The empty state uses fictional examples and works on desktop and mobile widths.

## 3. Add a documentation link to the readiness panel

Expected:
Readiness warnings for missing credentials should link to the relevant README setup section.

Files:
`src/components/dashboard-shell.tsx`, `README.md`

Difficulty:
Beginner

Acceptance criteria:
Each link points to an existing section and does not open a broken anchor.

## 4. Add tests for hashtag extraction edge cases

Expected:
Cover duplicate hashtags, lowercase/uppercase variants, punctuation, and posts without hashtags.

Files:
`src/lib/policy.ts`, `tests/policy.test.ts`

Difficulty:
Beginner

Acceptance criteria:
Tests pass and document the expected normalization behavior.

## 5. Add an engineering role input template

Expected:
Seed a template that helps engineers turn technical tradeoffs, debugging lessons, or infrastructure work into useful X posts.

Files:
`src/lib/demo-store.ts`, `prisma/seed.ts`

Difficulty:
Beginner

Acceptance criteria:
The template appears in seeded demo data and uses fictional examples only.

## 6. Improve the missing Docker error in `npm run demo`

Expected:
If Docker is not running or `docker compose` is unavailable, the demo script should print a clear next step.

Files:
`scripts/demo.mjs`

Difficulty:
Beginner

Acceptance criteria:
The error message mentions Docker Desktop or a Docker-compatible runtime and keeps the original failure visible.

## 7. Add FAQ links for common setup errors

Expected:
Add FAQ entries for database connection failure, Redis connection failure, missing AI key, and X OAuth callback mismatch.

Files:
`docs/FAQ.md`, `README.md`

Difficulty:
Beginner

Acceptance criteria:
The FAQ entries are short, accurate, and linked from README.

## 8. Add a screenshot refresh guide

Expected:
Document how maintainers should refresh `docs/assets/sparko-demo.png` using fictional demo data.

Files:
`docs/FAQ.md`, `docs/ROADMAP.md`

Difficulty:
Beginner

Acceptance criteria:
The guide warns against real accounts, tokens, browser extensions, and private data in screenshots.

## 9. Add tests for schedule interval validation

Expected:
Cover posts scheduled too close together for the same account and posts scheduled safely apart.

Files:
`src/lib/policy.ts`, `tests/policy.test.ts`

Difficulty:
Intermediate

Acceptance criteria:
Tests describe the expected minimum interval behavior and pass without relying on wall-clock timing.

## 10. Add a concise demo reset command

Expected:
Add a script that resets local Docker data and reseeds fictional `Example Studio` records.

Files:
`package.json`, `scripts/`, `README.md`

Difficulty:
Intermediate

Acceptance criteria:
The command warns before deleting local demo data and does not remove `.env.local`.
