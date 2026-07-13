# Production Readiness

This app now has a PocketBase backend foundation, but production launch requires a clean environment and a few explicit checks.

## Required Commands

Run these before deploying:

```bash
npm run pb:init
npm run prod:check
npm run test
npm run build
```

`npm run prod:check` fails if required production environment variables are missing, localhost URLs are still configured, required PocketBase collections are absent, or legacy local collections remain.

## Production Environment

Use `.env.production.example` as the starting point. Do not reuse local development secrets.

Required variables:

- `NEXT_PUBLIC_BASE_URL`
- `POCKETBASE_URL`
- `NEXT_PUBLIC_POCKETBASE_URL`
- `POCKETBASE_SUPERUSER_EMAIL`
- `POCKETBASE_SUPERUSER_PASSWORD`
- `AUTH_SESSION_SECRET`

Rotate any secret that has been pasted into chat, screenshots, logs, or source files.

## Render Deployment Blueprint

This repo includes `render.yaml` with two services:

- `bace-app`: the Next.js web app.
- `bace-pocketbase`: PocketBase using the public `ghcr.io/muchobien/pocketbase:latest` image and a persistent disk mounted at `/pb/pb_data`.

Before applying the Blueprint, push `render.yaml` to the Git remote, then open:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/damiTheCoder/naija-tax-agent
```

Fill these Dashboard env vars with production values:

- `NEXT_PUBLIC_BASE_URL`: the Render URL or custom domain for `bace-app`.
- `POCKETBASE_URL`: the HTTPS URL for `bace-pocketbase`.
- `NEXT_PUBLIC_POCKETBASE_URL`: the same HTTPS PocketBase URL.
- `POCKETBASE_SUPERUSER_EMAIL`: production PocketBase superuser email.
- `POCKETBASE_SUPERUSER_PASSWORD`: production PocketBase superuser password.
- `POCKETBASE_DEFAULT_ADMIN_EMAIL`: first platform admin email.
- `POCKETBASE_DEFAULT_ADMIN_PASSWORD`: first platform admin password.
- `GOOGLE_GEMINI_API_KEY`: production Gemini key, if AI validation stays enabled.
- `GOOGLE_OAUTH_CLIENT_ID`: Google OAuth web client ID for PocketBase login.
- `GOOGLE_OAUTH_CLIENT_SECRET`: Google OAuth web client secret for PocketBase login.

After both services are live, run `npm run pb:init` locally with production env vars or from the Render shell for `bace-app`, then run `npm run pb:oauth:google` to enable Google login. After that, run:

```bash
npm run prod:check
curl https://your-app-domain/api/pocketbase/health
```

## PocketBase

PocketBase must run with persistent storage and backups. Minimum production setup:

- TLS-enabled public URL for PocketBase.
- Persistent volume for `pb_data`.
- Regular backups of `pb_data`.
- Superuser credentials stored only in the deployment secret manager.
- `npm run pb:init` applied against the production PocketBase instance.
- `npm run pb:oauth:google` applied after adding Google OAuth credentials.

## Backend Guardrails Added

- Business-owned PocketBase records are scoped by business ownership/membership.
- Business creation creates owner membership and a default chart of accounts.
- Journal posting goes through a server API and validates double-entry balance.
- Business creation and journal posting write to `audit_logs`.
- Financial report views are read-only PocketBase view collections.

## Remaining Launch Work

Before public launch, finish these:

- Wire frontend flows to `/api/pocketbase/businesses` and `/api/pocketbase/accounting/journal-entries`.
- Add server routes for invoice numbering, invoice posting, bill posting, and payment posting.
- Implement bank provider token exchange and webhook handling server-side only.
- Implement AI action approval/execution through server APIs.
- Configure email verification and password reset for production auth.
- Remove or migrate legacy local collections: `ACCOUNTS`, `AUTH_COLLECTION`, `BUSINESSES`, `Journal_Entries`, `Transactions`.
- Add end-to-end tests for register/login, create business, post journal, reports, admin/support, and audit logs.

## Operational Checks

After deployment, verify:

```bash
curl https://your-app-domain/api/pocketbase/health
```

Expected result:

```json
{"success":true,"status":"healthy"}
```

## Local Verification Status

Verified locally on 2026-07-12:

- PocketBase was already running on `127.0.0.1:8090`.
- `npm run pb:init` completed against the real local PocketBase instance.
- `/api/pocketbase/health` returned healthy.
- User registration, session restore, logout, and login all succeeded through the app API.
- Default admin login succeeded and `/admin` returned HTTP 200.
- Admin user update wrote an `admin_audit_logs` record.
- Business provisioning wrote `audit_logs.business.created`.
- Balanced journal posting wrote `audit_logs.journal_entry.posted`.
- `npm test` passed: 14 files, 123 tests.
- `npm run build` passed.

Known remaining production blocker:

- `npm run prod:check` intentionally fails while `NEXT_PUBLIC_BASE_URL`, `POCKETBASE_URL`, and `NEXT_PUBLIC_POCKETBASE_URL` point to localhost. Replace those with the real deployed HTTPS URLs, then rerun the check.
