# CreatorHub backend

NestJS, GraphQL and MongoDB backend for creator discovery, portfolio projects, services and private project inquiries. A separate batch application delivers public activity notifications.

CreatorHub adapts the Nestar architecture. Features retain separate modules, services and resolvers, with flat Mongoose schemas and separate DTO and enum files. The frontend is a separate repository.

## Run locally

Use Node.js 22.22.1 or newer within Node 22, and npm. The `.nvmrc` selects Node 22 for local development; Docker supplies its own Node runtime. MongoDB must be a replica set because application workflows use transactions.

```bash
npm ci --legacy-peer-deps
```

Create an ignored `.env` file with these settings. Replace the secret placeholder with at least 32 random characters.

```dotenv
MONGO_DEV=mongodb://127.0.0.1:27017/creatorhub_dev?replicaSet=rs0
SECRET_TOKEN=replace-with-a-random-secret-of-at-least-32-characters
FRONTEND_URL=http://localhost:7007
PORT_API=7001
PORT_BATCH=7002
UPLOAD_BASE_URL=http://localhost:7001/uploads
UPLOAD_DIR=uploads
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Never commit the generated value or a credential-bearing MongoDB URI.

Use an existing replica set, or start the local development database with `docker compose up -d --wait`. The supplied Docker database binds to localhost and has no authentication; use it only for local development. Check that port 27017 is available first.

```bash
npm run db:setup
npm run start:dev
```

In another terminal, run `npm run start:dev:batch`. The API defaults to http://localhost:7001/graphql. `GET /` returns `CreatorHub API`. GraphQL playground is available outside production.

`db:setup` creates indexes and seeds six initial categories. It preserves existing category edits and does not migrate old account records. Run it only against the intended database.

## Structure

| Path | Purpose |
| --- | --- |
| `apps/Creator-api/src/components/` | Feature modules, resolvers, services and guards |
| `apps/Creator-api/src/schemas/` | Mongoose models |
| `apps/Creator-api/src/libs/dto/` | GraphQL inputs, updates and response types |
| `apps/Creator-api/src/libs/enums/` | Domain statuses and roles |
| `apps/Creator-api/src/database/` | Model registration, indexes and administrator setup |
| `apps/Creator-api/test/` | Unit and disposable-database integration tests |
| `apps/Creator-batch/` | Activity notification worker |
| `public/demo-media/` | Bundled fictional demo artwork |

## Accounts and security

Email signup requires a display name, contact phone number and password. Passwords are 6–30 characters and require a letter, number and symbol. Email confirmation activates email access. Phone signup and phone login are disabled; the phone number is private contact information.

Google, Telegram and Kakao authentication verify provider credentials. New social users complete their display name and contact phone before account creation. Accounts are not automatically merged by email. Configure provider audiences, secrets and allowed origins before using social sign-in.

Access tokens last 15 minutes. Refresh tokens rotate, and newly created sessions expire 15 days after creation. Refresh does not extend that deadline. Logout, suspension, account deletion and password reset revoke sessions. Existing sessions retain their stored expiry dates.

Password hashes belong to authentication identities and never appear in GraphQL responses. Email replacement requires the current password and a recent session; the original address remains usable until the new address is confirmed. Confirmation revokes existing sessions.

To grant administrator access to an existing active, verified email account, run:

```bash
npm run db:admin -- registered-email@example.com
```

Public signup cannot choose an administrator role. Administrators manage content and accounts but cannot read private inquiry conversations.

## Business workflows

- Public discovery includes published Korea-based creators, projects and services, with category, location and remote filters.
- Creator profiles, projects and services require administrator approval. Changes to published content retain the approved version while a candidate awaits review.
- Members can like and save projects, comment and follow creators. Saves are private.
- Inquiries are participant-only. Submission captures the selected service details and records notifications transactionally. Request UUIDs prevent duplicate submissions and messages on retry.
- Inquiry transitions enforce participant permissions. Closed, cancelled or declined inquiries cannot accept new messages.
- Customers can mark an agreed, closed inquiry completed and submit one rating and written service review.
- Public activity delivery uses durable worker leases, checkpoints and unique recipient/event keys. Keep the batch application running alongside the API.

Lists return `list` and `metaCounter`, use one-based pages and limit results to at most 50 per page.

## Integrations and media

Resend delivery uses `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. The existing `MAIL_WEBHOOK_URL` and `MAIL_WEBHOOK_TOKEN` adapter remains available when Resend is not configured. Development-only mail files are used when no provider is configured. Production requires an email provider.

Authenticated `imageUploader` and `imagesUploader` operations accept avatar or project uploads, with a 10 MB per-file limit and at most ten files per request. Files live under `UPLOAD_DIR` and are served at `/uploads`. `UPLOAD_BASE_URL` must use HTTPS in production. Keep this directory persistent and outside Git.

The API serves fictional demo artwork from `public/demo-media/`. The API build packages the same files into `dist/apps/Creator-api/public/demo-media/`. Keep the source media directory when running from the repository root. Demo artwork is AI-generated and does not represent real commissions. Do not store private media in this publicly served folder.

Optional `DISCOVERY_PARSER_URL` and `DISCOVERY_PARSER_TOKEN` settings enable a structured discovery adapter. Without it, discovery uses the explicit keyword fallback. Provider results cannot bypass public visibility checks.

## Verify changes

```bash
npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
npm run build:batch
```

Integration tests use disposable MongoDB replica sets and mock outbound email. MongoDB Memory Server may download its test binary on the first run. Tests do not connect to `MONGO_PROD`.

`npm run schema:export` generates the local `docs/schema.graphql` contract without requiring a database. The frontend keeps a copy for its contract checks. Internal working notes and verification output remain local.

## Deployment status

Deployment preparation is in progress. Dependency security upgrades and live production authentication, upload and email workflows still require verification.

Set `NODE_ENV=production`, a separate `MONGO_PROD` URI, a strong secret, an HTTPS `FRONTEND_URL`, an HTTPS `UPLOAD_BASE_URL`, persistent `UPLOAD_DIR` and email credentials. Build both applications and run `npm run start:prod` and `NODE_ENV=production npm run start:prod:batch`. Run database setup against the intended production database before serving traffic.

Use explicit `PORT_API` and `PORT_BATCH` values. The worker defaults to 7002 when no override is provided. On a shared VPS, use dedicated CreatorHub directories and services, available assigned ports and a domain-specific reverse proxy. Preserve other applications' files and services.

The retained starter dependencies include older peer ranges. Use the install flag above with the committed npm lockfile.


## Local reverse proxy

When Nginx on the same server proxies this application, set the server-only `TRUST_PROXY=loopback`. Leave it unset when clients connect directly. Restrict application ports to local access and have the CreatorHub Nginx location overwrite `X-Forwarded-For` with `$remote_addr`. Do not enable unrestricted proxy trust or accept arbitrary client-supplied forwarding headers. Configure only CreatorHub's proxy locations on a shared server.

Production service, HTTPS proxy, monitoring, backup and paired rollback templates are in [deploy/README.md](deploy/README.md). They are prepared files and still require installation and live verification on the shared VPS. `GET /health` checks database connectivity without returning private details. Production defaults to listening on `127.0.0.1`; local development retains network access unless `LISTEN_HOST` is overridden.
