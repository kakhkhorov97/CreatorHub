# ER update — 27 September 2026

The backend now uses the revised 17-collection model. The app paths and NestJS schema → DTO/enum → module → service → resolver organization are retained. Resolvers handle GraphQL requests; services own business rules; schemas own persistence. Input DTOs use separate class-validator decorators, as in Nestar. No frontend, payment, booking, ranking, SMS, or additional product workflow was added.

## Where to read the code

| Change | Main files under apps/Creator-api/src |
| --- | --- |
| Account fields, USER/CREATOR/ADMIN and English default | schemas/user/User.model.ts, libs/dto/user/, libs/enums/creatorhub.enum.ts |
| Five login methods and linked identities | schemas/auth/, libs/dto/auth/, components/auth/ |
| One editable category name | schemas/category/Category.model.ts, libs/dto/category/, components/category/ |
| First profile publication promotes USER to CREATOR | components/creator/creator.service.ts |
| Follow, like, save, and comment rules | schemas/engagement/, libs/dto/engagement/, components/engagement/ |
| First project publication records an event | components/project/project.service.ts |
| Durable activity notifications | schemas/notification/, components/activity/, components/notification/ |
| Inquiry history field rename | schemas/inquiry/InquiryEvent.model.ts, components/inquiry/inquiry.service.ts |
| Model registrations, indexes, and category seed | database/models.ts, database/setup.ts |

The database stores `performedById` for the action performer. `@CurrentUser()` reads the signed-in user from the request; it is not a collection or a stored field.

Passwords remain hashed with the existing salted scrypt helper. The hash is now stored with its EMAIL or PHONE identity and excluded from normal model reads and GraphQL. An identity-specific verification/reset token references `authIdentityId`. Sessions reference both the user and the login identity, which must belong to that user.

Comments require a client-generated UUID `clientCommentKey`, reused only when retrying that same project/content. Notifications have exactly one source: `inquiryEventId` or `activityEventId`. `getNotifications` returns nullable `event` (inquiry) and `activityEvent` (public activity), plus `unavailable` when the target is no longer visible. Worker progress and login credentials are not GraphQL fields.

## Existing database migration

No existing database was changed as part of this source update. Use a fresh dedicated CreatorHub development database for initial setup. `db:setup` creates indexes and seeds categories; it does not migrate records or drop stale indexes.

For an existing database, stop writes, take a backup, and prepare a reviewed migration against a restored copy first:

1. For every older user with local credentials, create one EMAIL authIdentity containing userId, normalized email as providerSubject, the existing passwordHash, and the former emailVerifiedAt as verifiedAt. Preserve identifier reservations for deleted/suspended users. Resolve duplicate normalized identifiers before indexing. Remove the old user credential fields and old users.email unique index only after verification of the migrated records.
2. Revoke old sessions and verification/reset tokens. They do not reference an identity and must not remain usable. Users sign in again after the migration.
3. Rename category nameEn to name, preserving the selected label; remove nameKo after deciding whether to include its text in name. This reflects the user's single-name decision. The existing city picker still has bilingual display labels.
4. Rename inquiryEvents.actorId to performedById and notifications.eventId to inquiryEventId. Remove the old global notification event index before creating the two new partial unique source indexes.
5. Give historical comments distinct UUID clientCommentKey values before creating the unique user/key index. Preserve existing publishedAt; older published projects must not trigger retroactive publication alerts.
6. Promote USER accounts whose retained creator profile was previously published to CREATOR. Keep ADMIN unchanged. Preserve account status and soft-deletion dates.
7. Create the revised indexes and validate all references and uniqueness. Compare application queries and totals against the restored database before switching the live database.

The guide's query indexes are initial candidates. This code keeps useful existing index names where their keys remain compatible and adds indexes for identities, follows, comment retries, and activity delivery. Review actual query plans before production sizing.

## External setup

Real email delivery requires the existing mail adapter configuration. Google, Telegram, and Kakao require configured applications and a frontend authorization flow; provider account credentials were not available for a live sign-in test. Signed token fixtures verify the backend signature/claims checks. Phone registration sends no message and makes no phone-ownership claim.

The social challenge map and request-rate counters are local to one API process. Before running multiple replicas, move those transient stores to shared infrastructure and bind the full provider authorization transaction to the browser. This does not require another product collection. No provider access/refresh token is persisted.
