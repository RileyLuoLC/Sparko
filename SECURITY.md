# Security Policy

## Supported Versions

Sparko is an early open-source project. Security fixes will target the latest version on `main` unless a release branch is created later.

## Protect Your Secrets

Sparko is designed for self-hosted use with your own X Developer app, X accounts, AI provider keys, database, and Redis queue.

Never commit:

- `.env` or `.env.local`
- X OAuth access tokens or refresh tokens
- `X_CLIENT_SECRET`
- `X_BEARER_TOKEN`
- `OPENAI_API_KEY`
- `XAI_API_KEY`
- `ANTHROPIC_API_KEY`
- database dumps
- screenshots or logs that contain secrets

Use `.env.example` as the public template and keep real credentials only in your local environment or deployment secret manager.

## Before Publishing a Fork

Run a local audit before pushing or publishing your fork:

```bash
rg -n "OPENAI_API_KEY=sk-|XAI_API_KEY=.+|ANTHROPIC_API_KEY=.+|X_CLIENT_SECRET=.+|X_BEARER_TOKEN=.+|access_token|refresh_token" --glob '!node_modules/**' --glob '!.next/**'
```

Also search for any real X handles, user ids, post ids, company names, and URLs that you used while testing locally.

## Reporting a Vulnerability

If you find a security issue, please do not open a public issue with exploit details or leaked credentials.

Report it privately by contacting the maintainer through GitHub or by opening a minimal issue that says you have a security report to share privately. Include:

- a short description of the issue
- affected files or routes
- reproduction steps if safe to share
- whether any credentials or user data may be exposed

The maintainer will review the report and coordinate a fix.
