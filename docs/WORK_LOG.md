# CreatorHub backend work log

## API request logging — 27 September 2026

Added HTTP request middleware and an Apollo lifecycle plugin in libs/utils/request-logger.ts, wired through main.ts and app.module.ts. The terminal receives one structured entry per completed or aborted HTTP request with a generated request ID, matched route, method, HTTP status, and duration. GraphQL entries include operation type/name, direct root field names, and deduplicated error codes. GraphQL failures are logged even when HTTP returns 200. Responses carry X-Request-ID for correlation. Request bodies, variables, headers, query strings, raw GraphQL documents, responses, and error messages are excluded from the log.

Formatting, lint, type checking, and API build passed. Three focused HTTP/Apollo tests passed, covering successful request correlation, omission of credentials in headers/variables/query strings/inline inputs, resolver failures with HTTP 200, GraphQL validation errors, and ordinary HTTP requests. The test server required sandbox approval to listen on a temporary local port. A read-only LoggerCheck query against the running backend returned HTTP 200 and X-Request-ID, confirming that the running process loaded the middleware. No database writes were performed for logger verification.

## Local sample data creation — 27 September 2026

Created sample data after the user authorized live requests against the running local backend. The public categories query returned an empty list, so inserted the six standard category seeds from database/setup.ts using insert-only upserts in the development database. No existing category records, indexes, account roles, or credentials were edited directly.

Used GraphQL mutations to register Demo Client and Demo Design Studio through phone/password authentication, create and publish the creator profile, create two draft portfolio projects, and create and activate two services. Publication promoted the creator account to CREATOR through the existing application transaction. Projects remain DRAFT because no media assets were uploaded. Services are Demo Landing Page Design at KRW 300,000 and Demo Mobile App UI Design with custom quotes.

Confirmed the creator account role/status, published profile, both draft projects, and both active services through authenticated GraphQL reads. Confirmed each active service is accessible through the public getService query. Sample credentials and record IDs are stored locally in /private/tmp/creatorhub-sample-records.json with mode 0600; no access or refresh tokens were written to that file or Postman. Application source was unchanged, and no automated test suite or production integration checks were run.

## Native GraphQL request correction — 27 September 2026

The first Postman collection used HTTP requests with GraphQL bodies. Replaced that format with 78 native GraphQL requests under docs/postman/CreatorHub-GraphQL/postman/collections/CreatorHub-GraphQL, keeping the 15 feature folders and filled query/input variables. Native requests use the local GraphQL endpoint, literal example inputs and PASTE_ placeholders for values the user must supply. No authorization tokens or token capture scripts were configured. Disabled automatic introspection by using schema source none.

Opened the native collection in Postman and confirmed loginPhone displays the native GraphQL icon, Query tab, populated operation and populated Variables editor. No backend requests or API tests were run. Postman file preparation uses an isolated local Git repository with a local-only origin under /private/tmp to enable Postman's native workspace sync; no Git hosting service or project remote was configured.

Pushed the native collection to the existing CreatorHub cloud workspace and verified its native loginPhone editor and variables there. Removed the superseded HTTP collection to Postman's recoverable trash and removed the temporary single-request setup collection. Authentication remains unconfigured for the user to handle manually.

## Postman request preparation — 27 September 2026

Created docs/postman/CreatorHub.postman_collection.json with 79 requests in 15 feature folders: all 78 existing GraphQL queries/mutations and the root GET endpoint. Users, follows, likes, saved projects, and comments each have separate folders. Included GraphQL input examples, public/authenticated/admin request authorization, editable collection variables for tokens and IDs, and manual workflow notes for inquiry versions, social challenges, email tokens, and account-scoped media URLs. Examples use fictitious contact/password data; no real credentials were copied. No test or pre-request scripts were added.

Prepared for the user's manual verification. No API requests, application tests, or live integration checks were run for this task. Application source was unchanged.

Imported the collection into the Postman CreatorHub workspace and confirmed all 15 feature folders are visible. The first import attempt failed; the revised import completed successfully. No requests were sent.

## Working agreement

Preserve the existing apps/Creator-api and apps/Creator-batch paths and explicit schemas, DTOs, enums, modules, services, and resolvers. Use npm, separate validation decorators, multiline schema fields, and the existing tab-based Prettier style. The project is backend-only.

## ER update completed — 27 September 2026

Used the revised ER guide in /Users/kakhkhorov/Desktop/docs and the user's later decisions: English locale default, one category name, performedById, unique phone/password registration without confirmation codes, five login providers, CREATOR role, follows, and first-project-publication follower alerts.

Added authIdentities, creatorFollows, and activityEvents to the existing model. Moved credentials/verification to identity records; sessions and tokens now reference identities. Added recent-sign-in linking/unlinking with last-usable-method protection and phone password replacement through another linked method. Added signed social ID-token verification with single-use nonces. Kept the existing scrypt password helper.

Updated creator promotion, follow state, comment retry keys, public activity delivery, notification source references, category fields, the administrator command, rate limits, and generated GraphQL schema. The model has 17 collections, 34 references, and 46 explicit indexes. The original module/service/resolver organization remains.

Validation completed against the source staged in the shared writable workspace before copying it to the requested folder:

- npm run format:check, lint, and typecheck: passed.
- API build and batch build: passed after final source changes.
- npm test -- --runInBand: 48 tests passed in three suites, including 32 isolated MongoDB/GraphQL/CLI scenarios, ten signed social-token cases, and six inquiry lifecycle boundary cases.
- Includes phone normalization/uniqueness, private hashes, identity revocation, linking collisions, pending linked-email confirmation, concurrent last-method unlink protection, phone password replacement, creator promotion and ADMIN preservation, comment retries, publication-only follower delivery, hidden notification targets, delivery rollback/retry, and suppression after unlike.
- Exported docs/schema.graphql and validated 12 documented GraphQL examples against it.
- Confirmed the installed phone parser version matches the retained package-lock entry; it is now declared as a direct dependency.

No live database migration, deployment, frontend callbacks, real social-provider login, or real email delivery was performed. See BACKEND_REVIEW.md and ER_UPDATE.md for integration and migration boundaries. The source backup path is recorded below.

Source backup: /Users/kakhkhorov/Desktop/Nestar/creatorhub-source-backup-20260927-024438.tar.gz

## Resolver response DTO cleanup — 27 September 2026

Moved AuthPayload, DiscoveryResult, SavedProjectResult, NotificationResult, and CreatorIdentity into separate files in their corresponding libs/dto feature folders. Resolvers now import these response classes and contain no ObjectType declarations or imports. Kept GraphQL names, fields, and resolver behavior unchanged, and added missing blank lines between methods in the touched resolvers.

Ran npm run format. Formatting check, lint, type checking, API build, and schema export passed. The exported GraphQL contract matches the prior schema after sorting definitions; only definition order changed. Existing tests were not rerun for this class relocation; validation focused on compilation and the generated API contract.

## Signed-in-user naming correction — 27 September 2026

Replaced the remaining @Actor() decorator with @CurrentUser() and renamed actor variables to currentUser throughout app source and related tests. Persisted event references remain performedById, as in the ER model. No Actor, actor, or actorId identifiers remain in application source. Updated ER_UPDATE.md. Formatting, lint, type checking, API build, and all 48 existing tests passed after the rename.
