# Deployment security review

Local verification on 11 October 2026 does not certify a live deployment. The VPS is shared, and the owner will perform its configuration manually.

The backend production and full dependency audits report zero advisories after a clean `npm ci --legacy-peer-deps` on Node 22.23.2. The frontend production audit also reported zero in its earlier verification. Audit totals can change as new advisories are published; repeat the audits when preparing a release.

The backend now uses Nest 11.2.7, its GraphQL/Apollo integration 13.4.5, Apollo Server 5.5.1 and Express 5.2.1. Feature modules, services, resolvers, DTOs, schemas and local GraphQL uploads remain in their existing locations. Targeted overrides patch indirect GraphQL Tools, request parsing and development tooling dependencies. The coverage configuration loader uses patched js-yaml 4 and passed a YAML configuration check.

All 138 backend tests passed across 13 suites after the clean installation. Typecheck, lint, Prettier and API/worker builds passed. The compiled API readiness endpoint, GraphQL query and worker startup also passed against a disposable local database. These checks do not verify Docker images or the live VPS. Some dependencies still carry npm deprecation notices; zero reported advisories does not guarantee that every package is maintained or that the application has no vulnerabilities.

The GraphQL GET middleware rejects unsupported Content-Type headers, following the Apollo advisory's mitigation. Multipart GraphQL POST uploads retain file limits, authentication, and signature checks. The upload parser now uses graphql-upload 15 and Busboy 1 while keeping the existing CommonJS Nest modules and local file storage.

- [Apollo cross-site search advisory](https://github.com/advisories/GHSA-9q82-xgwf-vj6h)
- [GraphQL Tools advisory](https://github.com/advisories/GHSA-7mx3-vvmw-hjmv)
- [Nest SSE advisory](https://github.com/advisories/GHSA-36xv-jgw5-4q75)

Shared browser sessions use localStorage, Web Locks for refresh, and reloads on logout or account switching. HTTPS is required for the production flow. Old per-tab sessions require a fresh login. Access tokens last fifteen minutes and session expiry remains fifteen days without extension on refresh.

A scan of locally reachable Git text history and current public files found no credentials matching the checked patterns. Binary files, large blobs, unknown patterns, and remote-only refs were not fully inspected. Rotate the private Resend key previously shared in chat before launch. Keep production environment files outside Git, with owner-only permissions. The PostHog project token is a public ingestion token, not a private administrative API key.

Production database indexes and initial categories were set up only in creatorhub_prod using its dedicated application user. An EJSON snapshot was restored into a disposable local replica set and record/index counts matched. This does not verify the VPS mongodump backup command or persistent upload backups.

Before launch, complete the manual runbook's HTTPS, provider callback, email-action, administrator, upload persistence, monitoring, backup and real rollback checks. Nginx templates have not been validated on the VPS. No friends' service, database, proxy configuration, or firewall was changed.
