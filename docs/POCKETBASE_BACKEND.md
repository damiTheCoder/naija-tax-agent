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

If this is your first boot, create a PocketBase superuser:

```bash
docker exec -it ql-pocketbase /pocketbase/pocketbase superuser upsert admin@example.com change-this-superuser-password
```

Then initialize collections/rules/indexes:

```bash
npm run pb:init
```

## 3. Configure social login providers

Open PocketBase admin UI at `http://127.0.0.1:8090/_/`.

For each OAuth provider (Google/GitHub), configure provider settings under the `users` auth collection.
Use this redirect URL in provider dashboards:

```text
http://127.0.0.1:8090/api/oauth2-redirect
```

For production, replace localhost with your production PocketBase domain.

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
