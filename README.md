# CreatorHub backend

NestJS, GraphQL, and MongoDB backend for discovering creators, browsing portfolios and services, and managing private project inquiries.

The implementation follows [the ER guide](docs/CreatorHub-ER-modeling-guide.md) and [the workflow](docs/creatorhub-workflow.png). The existing `apps/Creator-api` and `apps/Creator-batch` paths are retained deliberately. The code uses flat `schemas/*.model.ts`, separate input/update DTO files, `AuthMember` and `Roles` decorators, and separate like/follow/comment/save modules, services and resolvers. Password hashing uses `bcryptjs` inside `AuthService`, as in Nestar. The frontend is a separate project.

## Local setup

Use Node.js 20.19 or later and npm. This supports the restored UUID package in the CommonJS build. MongoDB must support transactions. A standalone MongoDB server will be rejected at startup.

1. Run `npm ci`.
2. Create a local `.env` with `MONGO_DEV`, `SECRET_TOKEN`, and `FRONTEND_URL`. See the configuration table in [the backend guide](docs/BACKEND_REVIEW.md).
3. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and put it in `SECRET_TOKEN`.
4. Start the supplied local replica set with `docker compose up -d --wait`, or set `MONGO_DEV` to an existing replica-set connection string.
5. Run `npm run db:setup` to create indexes and seed categories.
6. Run `npm run start:dev`.
7. In another terminal, run `npm run start:dev:batch` for public activity notification delivery.

The API defaults to `http://localhost:7001/graphql`. `GET /` returns `CreatorHub API`. The GraphQL playground is available outside production. The Docker database is bound to localhost and has no authentication; it is for local development only. Docker itself is not required when using an existing replica set.

`db:setup` creates the named unique, query, partial, and TTL indexes. It does not drop indexes or migrate existing records. If an older database contains users.email/passwordHash or notifications.eventId, it needs a separate migration before using the current identity/event model. No data migration is included here. Repeated runs preserve existing category edits. Use a separate `creatorhub` database for this product.

## Accounts and administrator access

Register with email or phone number, password, and display name. Passwords must be 6–30 characters. Email accounts must confirm their email before protected actions. Phone accounts use a unique international phone number and password, with no SMS or ownership confirmation. Google, Telegram, and Kakao use verified provider ID tokens. Each account starts as USER; publishing its first valid creator profile atomically promotes it to CREATOR. ADMIN keeps its role. The creator profile extends the same account.

Development verification and reset emails are saved as private files in `.local/mail/`. Open the newest matching file, copy the `token` query parameter from `actionUrl`, and call `verifyEmail(token: ...)` in GraphQL. The frontend verification pages will be implemented separately.

After registering and verifying your own account, an operator can run:

```bash
npm run db:admin -- your-email@example.com
```

This command grants `ADMIN` only to an existing active, verified account. Public registration and profile updates cannot set security roles. Administrator access does not grant access to private inquiry conversations.

Send access tokens in the `Authorization: Bearer <accessToken>` header. Access tokens last 15 minutes. Refresh tokens rotate and sessions expire 30 days after creation. Logout, account suspension, account deletion, and password reset revoke access through database session/account checks.

Login identifiers, verification dates, and password hashes are stored in `authIdentities`, not `users`. Password hashes never appear in GraphQL responses. `getMyAuthIdentities` is private to the signed-in account. No account is automatically merged because a social provider reports a matching email.

Link/unlink operations require a sign-in session created within the last ten minutes; refresh does not extend this window. Linked email must be confirmed before it is usable. Unlinking retains the identity reservation, revokes its sessions/tokens, and cannot remove the last usable method. Concurrent unlink operations serialize through the account. To replace a phone password, sign in recently with another linked method. Phone-only accounts have no automatic password recovery.

For social login, configure `GOOGLE_CLIENT_ID`, `TELEGRAM_CLIENT_ID`, and `KAKAO_CLIENT_ID` for the providers you enable. Call `beginSocialLogin`, include its nonce in the provider authorization request, then send the returned ID token and the same nonce to `loginSocial`. An unknown provider subject requires an explicitly entered `displayName` to register. Use `beginSocialLink`/`linkSocial` while authenticated to connect a provider to the same account. Nonces are single-use, expire after ten minutes, and distinguish login from account-specific linking. The frontend must bind authorization state to its initiating browser and handle the provider redirect/PKCE where applicable. This starter’s nonce store is in memory: run a single API process or provide a shared authentication transaction store before scaling. A restart cancels outstanding social sign-ins.

## Product workflow

- Public discovery supports categories, the published city list, remote availability, text matching, and service budget filtering.
- Creator profiles, portfolio projects, and services have distinct publication and availability rules. Incomplete drafts are private.
- Active accounts with a usable login method can like, save, comment, and follow public creators. Saves are private; hidden saved work returns an unavailable placeholder.
- An inquiry starts as a client-only draft. Submission captures the selected service snapshot, if any, and notifies the creator.
- The creator's first reply moves the inquiry into discussion. Messages use a client-generated UUID to deduplicate retries.
- Terminal actions follow the guide. A closed, cancelled, or declined inquiry cannot reopen or accept new messages.
- Followers receive in-app alerts only for a project’s first publication. Profile/service edits and archive/republish do not alert followers. New likes, comments, and follows notify the creator.
- Public activities are stored with the source action in one transaction; the batch application polls pending deliveries every five seconds using `@nestjs/schedule`. Delivery uses durable leases, batches of 100 followers, transactional checkpoints, and unique recipient/event keys.
- Every submitted inquiry action creates its history event and the other participant's notification in the same transaction.

Paginated list inputs use `page` starting at 1 and `limit` defaulting to 20, with a maximum of 50. The maximum page is 10,000. Responses contain `list` and `metaCounter`, where the total counts all matching records before pagination. Categories, cities and authentication identities remain unpaginated arrays. Lists use an ID tie-breaker, but are not snapshot pagination under concurrent edits.

## API reference

[docs/schema.graphql](docs/schema.graphql) is the generated GraphQL contract. Regenerate it with `npm run schema:export`; no database or credentials are needed for export. See [docs/API_EXAMPLES.md](docs/API_EXAMPLES.md) for the first frontend integration requests.

| Area | Main operations |
| --- | --- |
| Accounts | `register`, `login`, `registerPhone`, `loginPhone`, `beginSocialLogin`, `loginSocial`, `getMyAuthIdentities`, `linkEmail`, `linkPhone`, `beginSocialLink`, `linkSocial`, `unlinkAuthIdentity`, `changePhonePassword`, `me`, `updateMe`, `refreshSession`, `logout`, `verifyEmail`, `requestPasswordReset`, `resetPassword`, `deleteMyAccount` |
| Categories and cities | `categories`, `getCities`, `adminCategories`, `createCategory`, `updateCategory` |
| Creators | `getCreators`, `creator`, `myCreatorProfile`, `createCreatorProfile`, `updateCreatorProfile`, `setCreatorProfileStatus`, `deleteCreatorProfile` |
| Portfolios | `getProjects`, `getProject`, `getMyProjects`, `createProject`, `updateProject`, `setProjectStatus`, `deleteProject` |
| Services | `getServices`, `getService`, `getMyServices`, `createService`, `updateService`, `setServiceStatus`, `deleteService` |
| Engagement | `setCreatorFollow`, `getMyFollows`, `setProjectLike`, `setProjectSaved`, `getSavedProjects`, `getProjectComments`, `createProjectComment`, `editProjectComment`, `deleteProjectComment`, `moderateProjectComment` |
| Inquiries | `getInquiries`, `getInquiry`, `createInquiry`, `updateInquiry`, `deleteInquiryDraft`, `submitInquiry`, `sendInquiryMessage`, `getInquiryMessages`, `getInquiryEvents`, `closeInquiry`, `declineInquiry`, `cancelInquiry` |
| Notifications | `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markInquiryMessageRead` |
| Assisted discovery | `discoverCreators` |

## Email, media, and AI configuration

The external service contracts are documented in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

- Email: configure `MAIL_WEBHOOK_URL` and `MAIL_WEBHOOK_TOKEN` for delivery. Development files are the fallback; production requires an email adapter.
- Media: `imageUploader` and `imagesUploader` restore local GraphQL uploads. Use target `avatar` or `project`, up to 10 MB per file and ten files per request. Files are stored in `uploads/<userId>/<target>/` and served under `/uploads`. Configure `UPLOAD_BASE_URL` to the public API URL ending in `/uploads`; production requires HTTPS. Existing `MEDIA_BASE_URL` references remain accepted for compatibility.
- AI: optionally configure `DISCOVERY_PARSER_URL` and `DISCOVERY_PARSER_TOKEN` for a structured-filter AI adapter. Without an adapter, the response explicitly reports `KEYWORD`. This fallback does not claim to be an LLM. Provider results cannot bypass public visibility checks or submit inquiries.

Do not use the example media hostname in a live deployment. Email and AI adapters, media storage, and the separate frontend are not provisioned by this repository.

## Validation commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run build:batch
npm test -- --runInBand
```

Integration tests start an isolated MongoDB replica set, use real indexes and transactions, and mock outbound email delivery. The first run downloads the pinned MongoDB 7.0.24 test binary into `.local/mongodb`. Tests need local port access and network access for that first download. They do not connect to `MONGO_PROD`.

`npm run test:integration` and `npm run test:e2e` run the GraphQL integration suite. `npm run format` applies the original tab-based Prettier style. VS Code format-on-save settings are included; install the recommended Prettier extension.

## Deployment and portfolio notes

Set `NODE_ENV=production`, `MONGO_PROD`, a strong `SECRET_TOKEN` or `JWT_SECRET`, an HTTPS `FRONTEND_URL`, an HTTPS `UPLOAD_BASE_URL`, and email webhook credentials. Run `npm run db:setup` before serving traffic, then build both apps and run `npm run start:prod` and `npm run start:prod:batch`. Keep secrets outside source control and terminate HTTPS at the deployment ingress.

The batch app runs notification delivery on port 3002. Keep it running alongside the API. The API records activity events but does not schedule their delivery. Version 1 has no ranking jobs or automatic inquiry closure; MongoDB TTL indexes handle expired authentication record cleanup.

This is an adaptation of a Nestar starter. CreatorHub-specific work includes the 17-collection domain design, separate portfolios and services, revocable authentication, participant-only inquiries, immutable request snapshots, transaction-backed events, and acceptance tests. The starter's property, agent, board, view-counter, and ranking logic has been removed.

The review, verification evidence, and deployment limitations are in [docs/BACKEND_REVIEW.md](docs/BACKEND_REVIEW.md). Project memory is maintained in [docs/WORK_LOG.md](docs/WORK_LOG.md).

## October inquiry and review update

The website sends new inquiries directly with `sendInquiry`. Creation, submission and notification share one transaction. A customer request UUID makes retries return the same inquiry. Existing draft APIs remain for retained drafts and compatibility.

Only the original customer can mark an agreed, closed inquiry completed with `completeInquiry`, then submit one 1–5 rating and written review through `createServiceFeedback`. Public `getCreatorFeedback` requires a visible Korea-based creator; private `getInquiryFeedback` requires an inquiry participant. The same account retains its ID and credentials when becoming a creator.

New passwords are 6–30 characters. Existing bcrypt and scrypt passwords still verify. Passwords exceeding bcrypt's byte limit use a versioned SHA-256 prehash to preserve every character.

### Bundled demo artwork

The 51 approved demo portraits and project images are stored in `public/demo-media/`. The API serves them at `/demo-media/<filename>`. `npm run build` packages the same files into `dist/apps/Creator-api/public/demo-media/`. When deploying from the repository, keep `public/demo-media/` beside the application. When deploying only the compiled API directory, start it from `dist/apps/Creator-api` so its packaged `public/demo-media/` is the working directory's public folder. These bundled files are separate from creator uploads in `uploads/`; they do not require MongoDB binary storage. The public URL remains available even if a linked record is unpublished, so do not place private material in this folder.
