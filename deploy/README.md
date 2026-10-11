# CreatorHub VPS deployment

The owner selected **Docker deployment**. Start with [the Docker guide](docker/README.md). The systemd application deployment below is retained as an alternative; do not mix it with Docker. Its backup, monitor and automatic release-switch scripts are not compatible with the Docker deployment.

These files are prepared templates. They have not been installed or verified on the shared VPS. Complete the live acceptance checks before public traffic. Use one Linux account named `creatorhub`, one paired release, and ports 7001, 7002 and 7007. Never overwrite `default` or `hadijam`, change global firewall rules, upgrade the shared Node installation, reboot the VPS, or restart your friend's services.

## Files and permissions

Keep `/srv/Sean/creatorhub/backend` and `frontend` as staging checkouts. Each finished release goes under `/srv/Sean/creatorhub/releases/RELEASE_ID/backend` and `frontend`. The `current` symlink selects both together. `shared/uploads`, environment files, ACME challenges and backups persist across releases. Builds require development dependencies; do not run `npm ci --omit=dev` before building.

Before installing anything, confirm `/usr/bin/node` is the existing Node 22 installation, ports 7001/7002/7007 are still free, no `creatorhub` service or Linux account belongs to somebody else, and no other Nginx file claims the CreatorHub domains. Record the existing Hadijam HTTP status and `nginx -t` result. Create the dedicated account if absent, without granting sudo. Give it read access to releases and ownership only of its upload and frontend cache directories. Do not change ownership recursively outside `/srv/Sean/creatorhub`.

Copy environment templates to `shared/backend.env` and `shared/frontend.env`. Fill placeholders privately. Files must be mode 600, readable only by root and the CreatorHub service account as required. Both Node dotenv and systemd read these files: use plain assignments, quote values containing spaces, and do not use `export`. Rotate previously shared private API keys. Do not copy the development database URI or development sessions. Keep the dedicated database `creatorhub_prod` and its database-scoped user.

Copy the frontend production settings into the release's ignored `.env.production.local` before building. Next.js embeds `NEXT_PUBLIC_*` values at build time. Never prefix Gemini or provider secrets with `NEXT_PUBLIC_`. Do not copy `.env.development` or `.env.local` into a production release. Keep the local development environment unchanged.

## Build and database setup

In the release backend run `npm ci --legacy-peer-deps`, `npm run build`, and `npm run build:batch`. In the release frontend run `npm ci --legacy-peer-deps` and `npm run build`. Build sequentially to limit memory pressure on friends' applications. Do not run demo scripts or install a new database on the VPS.

Copy `shared/backend.env` into the release backend's ignored `.env`, mode 600. Run `NODE_ENV=production npm run db:setup` from that backend. This creates indexes and initial categories only in the configured database and preserves existing category edits. Check the database name privately before executing. Do not use `syncIndexes`, drop collections, or migrate friends' data.

Register and verify your designated administrator address through the real website after HTTPS is working. Then run `NODE_ENV=production npm run db:admin -- YOUR_VERIFIED_EMAIL` from the backend. This promotes an existing verified account and preserves its password. No automatic administrator creation or password reset is included.

## Services and HTTPS

Install only the three `systemd/creatorhub-{api,worker,frontend}.service` files in `/etc/systemd/system`. `systemctl daemon-reload` rereads definitions without restarting existing services. Services start through `switch-release.sh`, which checks all three applications and restores the previous paired release if readiness fails. Confirm service account directory traversal and write permissions before starting.

Install `nginx/creatorhub-http.conf` as the new `/etc/nginx/sites-available/creatorhub`, then link it under `sites-enabled`. Create `shared/acme` readable by Nginx. Run `nginx -t`; reload Nginx only after success. A reload applies the new site while keeping existing connections. This HTTP stage deliberately returns 503 for the app while certificates are being prepared.

If Certbot already exists, obtain a separate certificate with `certbot certonly --webroot -w /srv/Sean/creatorhub/shared/acme --cert-name creatorhub.site -d creatorhub.site -d www.creatorhub.site -d api.creatorhub.site`. Do not invoke Certbot's Nginx installer against friends' sites. Back up the CreatorHub HTTP file, replace only it with `creatorhub-https.conf`, run `nginx -t` again and reload. Check the existing renewal mechanism rather than adding a duplicate global timer. Nginx configuration syntax and certificate issuance still need verification on the actual server.

The API and worker bind to localhost. Next runs with `-H 127.0.0.1`. Nginx overwrites forwarded visitor headers and accepts up to 105 MB for a ten-file upload. The backend keeps its per-file 10 MB limit and file signature validation. No public route proxies to the worker. Uploads are public media; never place private documents there.

## Monitoring

Configure an external HTTPS monitor for `https://creatorhub.site/account/sign-in` and `https://api.creatorhub.site/health`, with a notification channel you control. `/health` reports only status and returns 503 if MongoDB is unavailable. Never count PostHog as uptime or server error monitoring. Check the three CreatorHub systemd services and journals. Backend request logs record error codes and request IDs without tokens or bodies. Alert on repeated crashes and internal GraphQL errors, including errors returned with HTTP 200. The included monitor checks the three endpoints and CreatorHub service states every five minutes. It sends one Resend alert after two failed availability checks, an immediate alert for critical application log errors, and one recovery alert. Set MONITOR_EMAIL privately, create shared/monitoring owned by root, install only its two systemd files, and enable creatorhub-monitor.timer after testing notification delivery. The monitor is unit-tested with mocked HTTP responses; it has not sent a live alert. It runs on the same VPS and cannot alert if the VPS is completely down, so also configure an external uptime monitor. It reads only the three CreatorHub service journals, including internal GraphQL errors returned with HTTP 200. Log access failures are reported as a failed check. An external log service remains optional; this same-server monitor cannot replace external uptime checks.

## Backups and restore

The backup command requires MongoDB Database Tools already installed or a separately reviewed install. It reads credentials from a private temporary config file, restricts the database to `creatorhub_prod`, and archives uploads. Run `bash deploy/backup.sh` as root from the current backend; it pauses only CreatorHub's API and worker briefly and resumes those that were running, including after failures. The frontend can stay running but writes are temporarily unavailable. The optional daily timer uses server local time at 04:00. Enable it only after one successful backup and restore rehearsal. No backup is automatically deleted. Copy backups to private off-server storage and define retention before enabling the timer.

Test `mongorestore` into a disposable replica set, never over production. Map namespaces with `--nsFrom 'creatorhub_prod.*' --nsTo 'creatorhub_restore_test.*'`. Use temporary private `--config` for credentials rather than placing URIs in command arguments. Verify collection counts and required indexes. Extract the uploads archive into a new temporary directory, verify filenames and contents, then delete the disposable restore database only. Database tools and a live backup/restore rehearsal remain unverified.

## Rollback

Run `bash deploy/switch-release.sh RELEASE_ID` as root. Each release must contain both backend builds and the frontend BUILD_ID. The script stops and starts only the three CreatorHub services, swaps one symlink atomically, and probes readiness. A failed candidate restores the preceding pair. It never reloads Nginx or changes the database. Keep the previous build and compatible database schema. This does not undo data mutations or replace a backup restore. Test the script with the included local simulation and repeat a real rehearsal on the VPS before public launch.

## Acceptance before opening the site

Verify signup, email receipt and verification, login, refresh, logout, password reset single use, Google/Telegram/Kakao completion at registered production origins, avatar and project uploads, an approval submission and admin badge/decision, private inquiry messages and Socket.IO reconnection. Use dedicated test accounts without changing unrelated data. Confirm CORS rejects unrelated origins, stack traces and playground are absent, upload files survive a release switch, and Hadijam still responds normally. Social consent and real inbox clicks require the account owner. Do not declare readiness from local unit tests alone.

The frontend now shares one login across tabs, with Web Locks for refresh rotation and reloads on account changes. Previously saved per-tab sessions require a fresh sign-in. The owner reports generating the introduction video using AI; keep that provenance truthful and follow the generating provider's distribution terms. A repository secret scan cannot prove that no credential ever escaped; rotate exposed private keys and review all remote branches and tags before making repositories public.

References: [Nginx proxy headers](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/), [MongoDB backup tools](https://www.mongodb.com/docs/database-tools/mongodump/).

See [the security review](SECURITY.md) for remaining dependency advisories and the limits of the local checks.

## Local verification commands

Run `node --test deploy/*.test.cjs` for rollback simulations and monitoring behavior. These use mocked services and HTTP responses and never control real VPS services or send email. They do not replace a live VPS rehearsal.
