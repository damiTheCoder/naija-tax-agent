# PocketBase Backend + Admin Console

This project now includes a PocketBase control-plane for:
- social/email auth
- user management
- complaint handling
- usage telemetry
- admin audit logs

The existing Prisma accounting/tax engine remains unchanged.

## 1. Environment variables

Add these to `.env.local`:

```bash
# PocketBase endpoint
POCKETBASE_URL=http://127.0.0.1:8090
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090

# PocketBase superuser (for server-side admin API calls + bootstrap script)
POCKETBASE_SUPERUSER_EMAIL=admin@example.com
POCKETBASE_SUPERUSER_PASSWORD=change-this-superuser-password

# App session signing secret (required)
AUTH_SESSION_SECRET=replace-with-a-long-random-secret

# Optional seeded admin app user for /auth/login
POCKETBASE_DEFAULT_ADMIN_EMAIL=owner@example.com
POCKETBASE_DEFAULT_ADMIN_PASSWORD=change-this-admin-password
POCKETBASE_DEFAULT_ADMIN_NAME=Platform Admin

# Google OAuth for PocketBase social login
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
```

## 2. Start PocketBase

```bash
npm run pb:up
```

If Docker is not installed on the machine, use the local binary fallback instead:

```bash
npm run pb:up:local
```

The local fallback expects the PocketBase binary at `./.tools/pocketbase/0.35.1/pocketbase` and stores runtime data under `.pocketbase/`.

If you want the full local stack in one command, use:

```bash
npm run dev:full
```

`dev:full` does this:
- reuses an already-running PocketBase instance when reachable
- starts local PocketBase automatically when the configured PocketBase URL is loopback and the local binary exists
- waits for PocketBase health before starting Next.js
- shuts down any PocketBase process it started when you stop the dev session

When you run `npm run dev`, the dev launcher now checks whether PocketBase is reachable before Next.js starts. If PocketBase is down, startup continues but you will see a warning with the likely recovery command.

To skip that preflight warning for a specific shell session:

```bash
DEV_SAFE_SKIP_POCKETBASE_PREFLIGHT=1 npm run dev
```

To change how long `dev:full` waits for PocketBase health before failing:

```bash
DEV_FULL_POCKETBASE_WAIT_MS=20000 npm run dev:full
```

If this is your first boot, create a PocketBase superuser:

```bash
docker exec -it ql-pocketbase /pocketbase/pocketbase superuser upsert admin@example.com change-this-superuser-password
```

Then initialize collections/rules/indexes:

```bash
npm run pb:init
```

When `POCKETBASE_URL` points to a local PocketBase instance (`127.0.0.1` or `localhost`) and `.pocketbase/pb_data/data.db` exists, `npm run pb:init` now auto-repairs old local rows with missing `created` / `updated` timestamps.

If you need to run the repair manually:

```bash
npm run pb:repair:local
```

This command only touches the local `.pocketbase/pb_data/data.db` file. It preserves existing timestamps, fills missing values from real fallback fields where possible, and interpolates gaps in record order for older local history.

To disable the automatic local repair during `pb:init`, set:

```bash
POCKETBASE_AUTO_REPAIR_LOCAL_TIMESTAMPS=0
```

## 3. Configure Google social login

This app only exposes Google as a social login provider.

1. In Google Cloud Console, create an OAuth 2.0 Client ID for a Web application.
2. Add this authorized redirect URI for local development:

```text
http://127.0.0.1:8090/api/oauth2-redirect
```

3. For production, add the same path on your production PocketBase domain:

```text
https://your-pocketbase-domain.com/api/oauth2-redirect
```

4. Add the client ID and secret to `.env.local`, then run:

```bash
npm run pb:oauth:google
```

The command updates the `users` auth collection in PocketBase and enables only the Google OAuth provider for app login.

## 4. New routes

- `GET /auth/login` admin sign-in page (email/password + social OAuth)
- `GET /admin` admin overview
- `GET /admin/users` user management
- `GET /admin/complaints` complaint queue
- `GET /admin/usage` usage analytics

## 5. API endpoints

Auth:
- `POST /api/auth/login`
- `POST /api/auth/oauth`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/providers`

Admin:
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET|PATCH /api/admin/users/:id`
- `GET /api/admin/complaints`
- `GET|PATCH /api/admin/complaints/:id`
- `GET|POST /api/admin/complaints/:id/messages`
- `GET /api/admin/usage`

Support:
- `POST /api/complaints`
- `POST /api/usage/track`

## 6. Security model

- Session cookie is httpOnly and signed with `AUTH_SESSION_SECRET`.
- `/admin/*` and `/api/admin/*` are route-guarded.
- Server-side APIs enforce role checks (`super_admin`, `support_admin`, `support_agent`, `read_only`).
- All admin mutations are logged to `admin_audit_logs`.
