# CreatorHub ER modeling guide

Version 1.2 proposed design • 26 September 2026

Revision: adds phone/password, email/password, Google, Telegram, and Kakao registration/login; linked authentication identities; creator follows; first-project-publication alerts; and like/comment/follow notifications. Phone registration has no SMS or ownership confirmation. CREATOR remains an account role.

This is the manual-entry specification for CreatorHub's MongoDB diagram in Moon Modeler. It replaces the earlier preliminary field lists. It describes the proposed CreatorHub design, not changes already implemented in Nestar.

The target workflow is discovery, portfolio viewing, service selection or direct contact, inquiry submission, conversation, and closure. Use this document while entering the model manually. The field dictionary, enum catalog, connection register, and index register are the source of truth.

Start with [the build order](#12-manual-moon-modeler-build-order), then use [the field dictionary](#4-field-dictionary), [enum catalog](#6-enum-catalog), [relationship register](#7-exact-relationship-register), and [index register](#8-index-register) while drawing. Finish with [the acceptance checklist](#13-acceptance-checklist).

## 1. Scope and decisions

The design has 17 collections, including three authentication support collections, creator follows, and public activity events. Embedded objects are not additional collections.

| Area | Collections |
|---|---|
| Accounts | users, creatorProfiles |
| Discovery | categories, portfolioProjects, services |
| Engagement | projectLikes, savedProjects, projectComments, creatorFollows |
| Inquiry workflow | inquiries, inquiryMessages, inquiryEvents |
| Notifications | activityEvents, notifications |
| Authentication support | authIdentities, authSessions, authTokens |

These product assumptions make the model concrete. They can be changed deliberately later; they are not requirements inferred from Nestar.

1. One account can both contact creators and maintain one creator profile. There are no team accounts in version 1.
2. Browsing and AI-assisted discovery are public. Likes, saves, comments, follows, and inquiries require an active account with at least one usable login identity as defined in section 16. An email address is not mandatory for phone or social accounts.
3. Sign-up and sign-in support PHONE plus password, EMAIL plus password, GOOGLE, TELEGRAM, and KAKAO. Phone numbers are unique normalized login names, with no SMS confirmation or ownership verification. Each account can link multiple login methods.
4. A creator may have several categories. Each portfolio project and service has one primary category.
5. Clients send private inquiries to one creator. There are no group conversations, payments, contracts, bookings, or delivery management in this workflow.
6. An inquiry can exist as a private draft after sign-in. Before sign-in, the browser can keep the form temporarily; do not create a fake user for a visitor.
7. Messages are text-only and immutable in version 1. Comments can be edited. Portfolio media is stored outside MongoDB; the database holds URLs and metadata.
8. Money uses KRW only. All amount fields store whole won between 0 and 1,000,000,000. This is a chosen product limit, not a currency restriction.
9. AI discovery reads public profiles, projects, and services. Assistant conversations and embeddings are not persisted in this version. AI suggestions never submit inquiries or change records automatically.
10. Counts are calculated from their source collections initially. Do not copy Nestar's like/view/rank counters without a measured need and a consistency strategy.
11. Public content is soft-deleted. Historical inquiries keep references to retained records. Permanent account erasure needs a separate retention and anonymization policy before a public production launch.
12. A closed inquiry cannot be reopened in version 1. A new request creates a new inquiry.

## 2. Reading and entering the model

Use plural camelCase collection names, singular camelCase field names, and uppercase enum values. In the actual field name, enter `skills`, not `skills[]`; mark the array option separately.

Locale values `ko` and `en` are the deliberate lowercase exception. All slug fields use lowercase ASCII letters and numbers separated by single hyphens, with no leading/trailing hyphen. Project slugs are 3–100 characters; other slug limits are in their field tables. All URL fields accept only validated HTTPS URLs up to 2048 characters. Trim human-entered text and validate its length after trimming.

| Notation | Meaning |
|---|---|
| NN | Required and non-null |
| UQ | Unique index exists; see the index register |
| REF | Stored ObjectId referencing another collection |
| ARR | Array; also define the item type |
| Optional | Omit the field until it has a value; do not store null or an empty string as a substitute |
| Conditional | Optional in the base schema but required by a stated business rule |

Every collection has `_id: ObjectId, NN`, generated by the backend, with MongoDB's existing unique `_id` index. Do not add a second `_id` index. `_id` is immutable.

All dates are BSON dates representing UTC instants. Display them in the user's locale. `createdAt` is backend-generated and immutable. `updatedAt` changes when mutable data changes. Immutable record types intentionally omit `updatedAt`.

`int` means an integer-valued number with the stated range. For a physical MongoDB validator, verify the BSON representation produced by the application. Nestar uses Mongoose Number, which does not by itself guarantee BSON Int32 storage. Either deliberately serialize Int32 or allow numeric BSON types and enforce integer/range validation. Do not generate an Int32-only validator and assume ordinary Mongoose Number writes will always match it.

Enums are stored strings. In Moon Modeler's MongoDB project type, choose the Enum field type and enter its permitted values in the Enum input. The catalog's names, such as `UserRole`, are documentation labels, not collections. Add the enum name and default to the field description. Do not draw relationship lines to enum notes. [Moon Modeler enum instructions](https://www.datensen.com/products/moon-modeler/solutions/mongodb/enum-mongodb/)

Defaults are backend behavior. Document them in field descriptions if the selected project type does not generate them. MongoDB schema validation checks data; it does not populate missing defaults.

## 3. Roles and permissions

`users.role` is the account permission role: USER, CREATOR, or ADMIN. `users.status` remains ACTIVE, SUSPENDED, or DELETED. CREATOR is a role, not an account status. Client describes the account that sends an inquiry.

One person has one account and at most one linked creator profile. These are two database records, not two logins or two required website profile pages. The website can display them together on one profile page.

| Account type | How identified | Allowed actions |
|---|---|---|
| Visitor | No authenticated account | Browse public data; use public AI discovery |
| User | role USER, status ACTIVE, usable login identity | Like, save, comment, follow creators, create/edit own draft creator profile, submit it for publication, create own inquiries |
| Creator | role CREATOR, status ACTIVE, usable login identity; owns creatorProfiles.userId | All regular user actions, plus manage own creator profile/projects/services and respond to own received inquiries |
| Client | User is inquiries.clientId | Read and manage own inquiries within the lifecycle rules |
| Admin | role ADMIN, status ACTIVE | Manage categories, suspend accounts, hide comments; also has regular user abilities and creator abilities on an owned profile |

Admin status does not automatically authorize reading private inquiry conversations. Private support access, if introduced, needs a separate permission and access audit.

Never let a public registration or profile-update request set `role`, account `status`, verification dates, ownership IDs, or system timestamps. Only the dedicated creator-publication operation can promote USER to CREATOR after its checks. Assigning ADMIN requires a separate authorized administrative operation. The backend derives the current actor ID from authentication.

### Becoming a creator and keeping records consistent

1. An active user with a usable login identity clicks "Become a creator". Create or return their single creatorProfiles record with status DRAFT. Keep role USER while they fill it in. Derive userId from the signed-in account.
2. They complete the publication requirements: headline, canonical city, and at least one active category, along with all base field rules.
3. On "Publish profile", validate account state, usable login identity, ownership, and profile fields. In one database transaction, change USER to CREATOR and the profile to PUBLISHED, setting its first publishedAt. An ADMIN keeps role ADMIN while publishing an owned profile.
4. CREATOR includes regular user abilities, so a creator can send inquiries to other creators. An ADMIN with an owned profile may perform creator actions on that profile; ADMIN alone never grants ownership or access to another creator's private conversations.
5. Before creating or managing projects/services, require an active CREATOR or ADMIN with a usable login identity and the owned, non-deleted creator profile. Creating a draft profile alone does not unlock those actions. Existing inquiry access follows participant ownership and active account checks, including after a profile is hidden or soft-deleted.

The unique creatorProfiles.userId index prevents duplicate profiles. Repeated onboarding/publication requests reuse the same record and must not create another profile. A CREATOR must have one retained profile record. A USER may have no profile or one DRAFT profile; a published or previously published profile belongs to a CREATOR or ADMIN.

Hiding or soft-deleting a profile does not reset the account role. Public visibility and new-content permissions still check profile state. Account suspension/deletion changes users.status and blocks access independently of role. There is no self-service CREATOR-to-USER downgrade in version 1. When granting ADMIN, retain any profile; when removing ADMIN, restore CREATOR if the retained profile has ever been published, otherwise USER. Administrative role changes must preserve these invariants.

## 4. Field dictionary

Each table contains the fields to enter after `_id`. Add `_id` first to all 17 collection boxes.

### 4.1 users

One account and its shared state. Authentication credentials live in authIdentities so several login methods can share the same user, creator profile, follows, and conversations.

| Field | Type | Required/default | Description |
|---|---|---|---|
| displayName | string | NN | 2–60 trimmed characters; not unique |
| avatarUrl | string | Optional | Approved HTTPS image URL |
| role | enum UserRole | NN, USER | USER, CREATOR, ADMIN; backend-controlled promotion |
| status | enum UserStatus | NN, ACTIVE | Account access state, independent of login provider |
| preferredLocale | enum Locale | NN, en | Interface language |
| lastLoginAt | date | Optional | Last successful login with any linked method |
| deletedAt | date | Conditional | Present exactly when status is DELETED |
| createdAt | date | NN, now | Account creation |
| updatedAt | date | NN, now | Last account update |

Do not add users.passwordHash, users.email, or users.phoneNumber in this revision. The login email or normalized phone is authIdentities.providerSubject; its password hash is in that same identity record. Account settings can retrieve these private values through userId. A user with Google login does not need a local password. Each user has at least one retained identity; an account that has completed registration must retain at least one usable method. A newly created email-only account may await verification, with product access blocked until then. Create a new user and its first identity atomically. Providers must never set role or account status.

### 4.2 creatorProfiles

One public professional identity per user, displayed with the same account. The owner cannot be reassigned. USER may own a draft; first publication promotes USER to CREATOR atomically. ADMIN keeps its role.

| Field | Type | Required/default | Description |
|---|---|---|---|
| userId | ObjectId | NN, REF, UQ | users._id |
| slug | string | NN, UQ | Public URL key, 3–80 lowercase ASCII letters, numbers, and single internal hyphens |
| headline | string | Optional; required to publish | 1–120 characters when present |
| bio | string | Optional | Maximum 3000 characters |
| city | string | Optional; required to publish | Canonical city key selected from the UI's controlled list; maximum 80 characters |
| remoteAvailable | bool | NN, false | Can deliver services remotely |
| availability | enum CreatorAvailability | NN, AVAILABLE | New-inquiry availability |
| categoryIds | ObjectId ARR | NN, REF, [] | References categories._id; 0–5 distinct values; at least one to publish |
| skills | string ARR | NN, [] | At most 20 distinct values; 1–50 characters each |
| socialLinks | object ARR | NN, [] | At most 8 embedded SocialLink objects |
| status | enum ProfileStatus | NN, DRAFT | Public visibility |
| publishedAt | date | Conditional | First publication time; required once ever published |
| deletedAt | date | Optional | Soft deletion overrides public visibility |
| createdAt | date | NN, now | Profile creation |
| updatedAt | date | NN, now | Last profile update |

City is a controlled string, not an incomplete enum copied from Nestar. Store one canonical key per location; translate its display label in the UI. The initial launch is Korea-focused. The location list must be defined before implementing the filter.

Public discovery requires a published, non-deleted profile and an active owner. BUSY means the creator still accepts inquiries but may respond later; UNAVAILABLE blocks new submissions. Hidden profiles can still participate in existing conversations unless their owner is suspended or deleted.

### 4.3 categories

Shared, administrator-managed creative categories. Categories are records because administrators can change them without a code release.

| Field | Type | Required/default | Description |
|---|---|---|---|
| slug | string | NN, UQ | Stable lowercase key, 2–80 characters |
| name | string | NN | One editable category label, 1–80 characters; Korean text may be included if desired |
| description | string | Optional | Maximum 500 characters |
| sortOrder | int | NN, 0 | Integer 0–10000 |
| isActive | bool | NN, true | Can be selected for new or republished content |
| createdAt | date | NN, now | Creation |
| updatedAt | date | NN, now | Last edit |

Example seed keys: graphic-design, photography, video-production, illustration, web-development, ui-ux-design. These are example records, not enum values. Deactivating a category preserves existing references and direct content pages, but removes it from new selections and category-filter choices.

### 4.4 portfolioProjects

A creator's case study or work sample. One creator owns the record for its lifetime.

| Field | Type | Required/default | Description |
|---|---|---|---|
| creatorId | ObjectId | NN, REF | creatorProfiles._id |
| categoryId | ObjectId | Optional, REF; required to publish | categories._id |
| title | string | NN | 1–150 characters |
| slug | string | NN | URL key; unique together with creatorId |
| summary | string | Optional | Maximum 300 characters |
| description | string | Optional; required to publish | Maximum 20000 characters; nonempty for publication |
| coverImageUrl | string | Optional; required to publish | Approved HTTPS image URL |
| media | object ARR | NN, [] | 0–20 embedded PortfolioMedia items; at least one to publish |
| tags | string ARR | NN, [] | At most 10 distinct normalized tags, 1–40 characters each |
| externalUrl | string | Optional | Approved HTTPS link |
| status | enum ProjectStatus | NN, DRAFT | Publication lifecycle |
| publishedAt | date | Conditional | First publication time |
| deletedAt | date | Optional | Soft deletion |
| createdAt | date | NN, now | Creation |
| updatedAt | date | NN, now | Last edit |

Public pages require PUBLISHED, no deletedAt, and a publicly visible creator. Publication requires an active category. Drafts can be saved with only the required base fields. Soft-deleted project slugs remain reserved for their creator.

### 4.5 services

An offering that can be selected in an inquiry. It is not an order or a completed project.

| Field | Type | Required/default | Description |
|---|---|---|---|
| creatorId | ObjectId | NN, REF | creatorProfiles._id |
| categoryId | ObjectId | Optional, REF; required to activate | categories._id |
| title | string | NN | 1–150 characters |
| description | string | Optional; required to activate | Maximum 10000 characters |
| pricingType | enum PricingType | NN, CUSTOM_QUOTE | Pricing presentation |
| startingPrice | int | Conditional | Whole KRW; 0–1000000000; required for STARTING_AT, absent for CUSTOM_QUOTE |
| currency | enum Currency | NN, KRW | Version 1 currency |
| estimatedDays | int | Optional | 1–365; estimate, not a contractual deadline |
| deliverables | string ARR | NN, [] | At most 15 items, 1–200 characters each; at least one to activate |
| status | enum ServiceStatus | NN, DRAFT | Availability to new inquiries |
| deletedAt | date | Optional | Soft deletion |
| createdAt | date | NN, now | Creation |
| updatedAt | date | NN, now | Last edit |

Only ACTIVE, non-deleted services owned by publicly visible creators accept new inquiries. Pausing or archiving a service does not close existing inquiries. A client's selected service must belong to the selected creator.

### 4.6 projectLikes

| Field | Type | Required/default | Description |
|---|---|---|---|
| userId | ObjectId | NN, REF | users._id |
| projectId | ObjectId | NN, REF | portfolioProjects._id |
| createdAt | date | NN, now | Like time |

The unique pair userId + projectId prevents duplicates. Unlike removes the document. Repeating a like or unlike request returns the resulting state rather than creating a duplicate or a server error. Likes are allowed only on publicly visible projects; self-likes are disallowed in this design. Creating a new like also creates one PROJECT_LIKED activity event in the same transaction. Repeated likes in the already-liked state do not notify again; unlike creates no notification.

### 4.7 savedProjects

| Field | Type | Required/default | Description |
|---|---|---|---|
| userId | ObjectId | NN, REF | users._id |
| projectId | ObjectId | NN, REF | portfolioProjects._id |
| createdAt | date | NN, now | Save time |

Unique pair userId + projectId. Private to its owner. Unsave removes the document. Saving one's own work is allowed. New saves require a public project. If a saved project becomes hidden or deleted, the saved list may show an unavailable item but must not expose its private content.

### 4.8 projectComments

| Field | Type | Required/default | Description |
|---|---|---|---|
| userId | ObjectId | NN, REF | users._id |
| projectId | ObjectId | NN, REF | portfolioProjects._id |
| clientCommentKey | string | NN | Client UUID reused on retry; unique with userId |
| content | string | NN | 1–2000 trimmed characters |
| status | enum CommentStatus | NN, ACTIVE | Moderation state |
| editedAt | date | Optional | Set only when the author edits content |
| deletedAt | date | Conditional | Present exactly when status is DELETED |
| createdAt | date | NN, now | Creation |
| updatedAt | date | NN, now | Content or status change |

Flat comments only. A retry key must match the original project and content or be rejected. A new comment creates one PROJECT_COMMENTED event in the same transaction; editing, hiding, or deleting a comment does not produce another creation alert. Authors edit/delete their own comments; admins can hide them. New comments require a public project. Editing a HIDDEN comment does not make it ACTIVE automatically. A project owner's comment is allowed.

### 4.9 inquiries

The private inquiry and its current state. The draft becomes the submitted record; do not create a second inquiry at submission.

| Field | Type | Required/default | Description |
|---|---|---|---|
| clientId | ObjectId | NN, REF | users._id; immutable |
| creatorId | ObjectId | NN, REF | creatorProfiles._id; immutable |
| serviceId | ObjectId | Optional, REF | services._id; optional for direct contact |
| subject | string | Optional; required to send | 1–150 characters |
| brief | string | Optional; required to send | 20–10000 characters |
| budgetMin | int | Optional | Whole KRW; 0–1000000000 |
| budgetMax | int | Optional | Whole KRW; 0–1000000000; must be at least budgetMin when both exist |
| currency | enum Currency | NN, KRW | Budget currency |
| desiredDeadline | date | Optional | Desired instant; must be in the future at submission |
| serviceSnapshot | object | Conditional | Embedded InquiryServiceSnapshot, captured at submission if serviceId exists |
| status | enum InquiryStatus | NN, DRAFT | Current lifecycle state |
| outcome | enum InquiryOutcome | Conditional | Present only for CLOSED |
| closedById | ObjectId | Conditional, REF | users._id; actor who closed, declined, or cancelled |
| closedAt | date | Conditional | Present exactly for CLOSED, DECLINED, or CANCELLED |
| submittedAt | date | Conditional | Present for every state except DRAFT |
| lastMessageAt | date | Optional | Last conversation message time; not the brief submission time |
| version | int | NN, 0 | Nonnegative application revision used for concurrent updates |
| createdAt | date | NN, now | Draft creation |
| updatedAt | date | NN, now | Last draft, message, or lifecycle update |

Drafts are visible only to the client. The client reviews the draft before submitting. Revalidate profile visibility, owner status, service ownership/status, and availability at submission. Client and creator owner must be different accounts.

After sending, freeze the original subject, brief, budget, service selection, deadline, and snapshot. Changes are discussed in messages. This preserves what the client originally requested. The selected service's title or price can change later without rewriting the original inquiry.

### 4.10 inquiryMessages

One immutable text message. Keep the growing conversation outside the inquiry document.

| Field | Type | Required/default | Description |
|---|---|---|---|
| inquiryId | ObjectId | NN, REF | inquiries._id |
| senderId | ObjectId | NN, REF | users._id |
| clientMessageKey | string | NN | Client-generated UUID reused when retrying the same message |
| body | string | NN | 1–5000 trimmed characters |
| readAt | date | Optional | First time the other participant reads the message |
| createdAt | date | NN, now | Server acceptance time |

Unique pair senderId + clientMessageKey. A retry with the same key must match the original inquiry and body; otherwise reject the conflict. Only the client or the creator's owner can send/read messages. Only the other participant can set readAt, once. There is no recipientId because the inquiry identifies the two participants.

Messages are allowed only in SENT or IN_DISCUSSION. The creator's first reply changes SENT to IN_DISCUSSION. Client follow-ups while SENT do not change that status. Public profile visibility does not revoke existing participant access; suspension or account deletion does revoke that account's access.

### 4.11 inquiryEvents

Append-only history of submissions, messages, and terminal decisions. This gives status changes an actor and supports reliable notification deduplication.

| Field | Type | Required/default | Description |
|---|---|---|---|
| inquiryId | ObjectId | NN, REF | inquiries._id |
| performedById | ObjectId | NN, REF | users._id |
| type | enum InquiryEventType | NN | Event that occurred |
| fromStatus | enum InquiryStatus | NN | State immediately before this event |
| toStatus | enum InquiryStatus | NN | State immediately after this event |
| messageId | ObjectId | Conditional, REF | inquiryMessages._id; only for MESSAGE_SENT |
| version | int | NN | Inquiry version after this action; at least 1 |
| createdAt | date | NN, now | Event time |

Unique pair inquiryId + version. Draft edits increment the inquiry version without creating an event, so event versions may have gaps. A MESSAGE_SENT event can have identical fromStatus and toStatus. For the creator's first reply it records SENT to IN_DISCUSSION; do not create another duplicate status event.

Events are visible only to inquiry participants. Actors cannot edit or delete submitted events. The event's actor and message, when present, must belong to the same inquiry and action.

### 4.12 notifications

One recipient's in-app notification for either a private inquiry event or a public activity event. Exactly one of inquiryEventId and activityEventId must be present. Both are optional in the base field table because the backend validates this exclusive choice.

| Field | Type | Required/default | Description |
|---|---|---|---|
| recipientId | ObjectId | NN, REF | users._id; private inbox owner |
| inquiryEventId | ObjectId | Conditional, REF | inquiryEvents._id; absent for activity notifications |
| activityEventId | ObjectId | Conditional, REF | activityEvents._id; absent for inquiry notifications |
| readAt | date | Optional | Recipient's first read time |
| createdAt | date | NN, now | Notification insertion time |

An inquiry event still produces exactly one notification for the other participant in the inquiry transaction. A public activity can produce notifications for many followers or one creator owner, according to section 17. Use a partial unique inquiryEventId index and a separate partial unique recipientId + activityEventId index. Never apply global uniqueness to activityEventId, because all followers share that event.

Render text and links through the selected event; do not copy private inquiry text into public activity. Count unread rows by missing readAt. Reading a notification does not automatically mark messages read. Recheck authorization and current content visibility when rendering or opening a notification. An unavailable target must not expose hidden content.

Delivery is in-app only. Choosing Telegram or Kakao for login does not subscribe the user to messages in those apps. External push, SMS, email, Telegram, and Kakao notification delivery is outside this revision.

### 4.13 authSessions

One revocable signed-in session, supporting refresh tokens and logout.

| Field | Type | Required/default | Description |
|---|---|---|---|
| userId | ObjectId | NN, REF | users._id |
| authIdentityId | ObjectId | NN, REF | authIdentities._id; must belong to the same userId |
| refreshTokenHash | string | NN, UQ | Hash of a high-entropy refresh token; never the raw token |
| expiresAt | date | NN | Absolute expiration, initially 30 days after creation |
| revokedAt | date | Optional | Logout or administrative revocation |
| lastUsedAt | date | Optional | Successful refresh time |
| createdAt | date | NN, now | Session start |
| updatedAt | date | NN, now | Rotation/revocation update |

Rotate the refresh token hash atomically using the existing hash as a condition. Version 1 uses an absolute 30-day session lifetime; rotation does not extend expiresAt. Protected requests check the session, its identity, and account state, including revocation and expiry. Revoking an identity also revokes its sessions. This design does not claim refresh-token-family reuse detection.

TTL on expiresAt is housekeeping only. The backend rejects an expired session even if the document is still present. MongoDB expiration is asynchronous. [MongoDB TTL behavior](https://www.mongodb.com/docs/manual/core/index-ttl/)

### 4.14 authTokens

Single-use email-verification and email-password-reset tokens. These are high-entropy email links, not phone confirmation codes. Phone registration does not use this collection.

| Field | Type | Required/default | Description |
|---|---|---|---|
| authIdentityId | ObjectId | NN, REF | authIdentities._id; must be an EMAIL identity |
| purpose | enum AuthTokenPurpose | NN | EMAIL_VERIFY or PASSWORD_RESET |
| tokenHash | string | NN, UQ | Hash of a high-entropy random token; never store the raw token |
| expiresAt | date | NN | Email verification: 24 hours; password reset: 30 minutes |
| consumedAt | date | Optional | Successful one-time use |
| revokedAt | date | Optional | Replacement, unlinking, or invalidation |
| createdAt | date | NN, now | Issuance |

Consume atomically only when unused, unrevoked, and unexpired, and the linked identity and account are eligible. Replacement invalidates outstanding tokens for the same identity and purpose. EMAIL_VERIFY sets that EMAIL identity's verifiedAt. PASSWORD_RESET is available only for a verified EMAIL identity and updates its passwordHash. The reset transaction consumes the token, invalidates other reset tokens, and revokes all sessions for its user. Expiration cleanup uses TTL, but the backend rejects expired tokens immediately. A phone-only account cannot receive email recovery without first linking an email method; section 16 defines recovery limits.

### 4.15 authIdentities

One login method linked to one user. One account can have one of each provider, up to five retained identity records. Linking methods does not create another public profile.

| Field | Type | Required/default | Description |
|---|---|---|---|
| userId | ObjectId | NN, REF | users._id; immutable owner |
| provider | enum AuthProvider | NN | EMAIL, PHONE, GOOGLE, TELEGRAM, or KAKAO |
| providerSubject | string | NN | Provider-specific unique login identifier; see section 16 |
| passwordHash | string | Conditional | Required for EMAIL and PHONE; absent for GOOGLE, TELEGRAM, KAKAO; hash only, private |
| verifiedAt | date | Conditional | EMAIL ownership confirmation or first successfully validated social login; always absent for PHONE in this design |
| revokedAt | date | Optional | Disables this linked method; retain its unique identifier |
| lastLoginAt | date | Optional | Last successful login through this method |
| createdAt | date | NN, now | Identity creation |
| updatedAt | date | NN, now | Password, verification, or revocation change |

The unique provider + providerSubject index prevents the same normalized phone, email, or provider account from belonging to two users. The unique userId + provider index limits an account to one identity per provider. Unlinking uses revokedAt, not hard deletion. Revoked identities and soft-deleted users keep their identifiers reserved. Relinking the same retained identity requires reauthentication and proof of that method as described in section 16. Replacing a phone/email address is not supported in v1.2; it needs a separate change/recovery policy.

A PHONE identity's absent verifiedAt is intentional and does not prevent phone/password login or creator promotion. A PHONE identity can never be presented as proof of phone ownership. A pending EMAIL identity cannot authenticate ordinary protected actions until verified. Do not copy Google, Telegram, or Kakao passwords, access tokens, or refresh tokens into this collection. Provider secrets stay in protected server configuration.

### 4.16 creatorFollows

One user's subscription to one creator profile. The unique pair is retained on unfollow so re-following updates the same record. Followers receive alerts only for newly published projects, never routine profile or service edits.

| Field | Type | Required/default | Description |
|---|---|---|---|
| followerId | ObjectId | NN, REF | users._id; user following the creator |
| creatorId | ObjectId | NN, REF | creatorProfiles._id; creator being followed |
| isActive | bool | NN, true | false after unfollow |
| followedAt | date | NN, now | Start of the current follow period; reset on re-follow |
| createdAt | date | NN, now | First follow record creation |
| updatedAt | date | NN, now | Follow/unfollow change |

Only an active account with a usable identity can follow a public creator. Self-follow is disallowed. USER, CREATOR, and ADMIN accounts can follow others. Repeated follow requests while already active or unfollow requests while inactive do not create new events. An inactive-to-active transition creates one CREATOR_FOLLOWED event in the same transaction. The creator receives a new-follower notification. An unfollow does not notify them.

The following list is private to its user. A creator may view their followers using public account fields only; public pages may show the aggregate count. Follow counts use isActive true and active follower accounts. A creator becoming hidden/deleted prevents new follows and publication delivery but may retain existing follow records. Following never grants access to private projects. Unfollow stops subsequent publication delivery; previously delivered notifications remain subject to visibility checks.

### 4.17 activityEvents

One durable public activity and its notification-delivery progress. Keep this separate from private inquiryEvents. The action data is immutable; delivery progress may change. Event records are internal notification sources, not an unrestricted public activity feed. Recipients can read only the display-safe data needed for their own notifications; worker fields and credentials are never exposed.

| Field | Type | Required/default | Description |
|---|---|---|---|
| performedById | ObjectId | NN, REF | users._id; account that performed the action |
| creatorId | ObjectId | NN, REF | creatorProfiles._id; owning or followed profile |
| type | enum ActivityEventType | NN | Publication, project like/comment, or new follow |
| projectId | ObjectId | Conditional, REF | portfolioProjects._id; required except for CREATOR_FOLLOWED |
| commentId | ObjectId | Conditional, REF | projectComments._id; present only for PROJECT_COMMENTED |
| actionKey | string | NN | Request UUID reused on retry; unique together with performedById |
| deliveryStatus | enum ActivityDeliveryStatus | NN, PENDING | PENDING, PROCESSING, or COMPLETE |
| deliveryCursor | string | Optional | Opaque worker pagination checkpoint, not a database reference |
| leaseUntil | date | Optional | Processing lease expiration for worker crash recovery |
| nextAttemptAt | date | NN, now | Earliest delivery/retry time |
| attempts | int | NN, 0 | Nonnegative delivery attempt count |
| completedAt | date | Conditional | Present exactly when deliveryStatus is COMPLETE |
| createdAt | date | NN, now | Action commit time; immutable |
| updatedAt | date | NN, now | Delivery progress change |

All referenced records must belong to the same creator/project context. PROJECT_PUBLISHED.performedById is the project's creator owner. PROJECT_LIKED.performedById is the liking user. PROJECT_COMMENTED.performedById is the comment author. CREATOR_FOLLOWED.performedById is the follower; projectId and commentId are absent.

A first-publication event has a partial unique projectId index restricted to PROJECT_PUBLISHED. It can be created only on the first DRAFT-to-PUBLISHED transition. Restoring ARCHIVED content, editing a project, changing a service, or editing a creator profile does not alert followers. A PROJECT_COMMENTED event is unique per commentId. Like/follow events are inserted only when the desired state actually changes. Do not store like or follow IDs here; unlike and unfollow must not break notification history. Section 17 defines transaction and delivery behavior.

## 5. Embedded objects and arrays

These boxes use containment lines and do not have standalone collection names or indexes. Configure Mongoose embedded schemas without automatic `_id` where no item identity is required.

### SocialLink, contained in creatorProfiles.socialLinks

| Field | Type | Rule |
|---|---|---|
| label | string | NN, 1–40 characters, such as Portfolio or Instagram |
| url | string | NN, approved HTTPS URL |

Maximum eight links; reject duplicate normalized URLs. A platform enum is unnecessary because creators can link to many websites.

### PortfolioMedia, contained in portfolioProjects.media

| Field | Type | Rule |
|---|---|---|
| type | enum MediaType | NN |
| url | string | NN, approved HTTPS media URL |
| altText | string | NN, 1–300 characters, accessible description |
| sortOrder | int | NN, 0–19; distinct within this project's media array |

Limit to 20 entries. File type, ownership, and accepted hosting locations are checked by the backend. Do not embed binary video/image data in this model.

### InquiryServiceSnapshot, contained in inquiries.serviceSnapshot

| Field | Type | Rule |
|---|---|---|
| title | string | NN, copied from service at submission |
| pricingType | enum PricingType | NN, copied at submission |
| startingPrice | int | Required only for STARTING_AT; same money range |
| currency | enum Currency | NN, KRW |
| estimatedDays | int | Optional, copied if present |
| deliverables | string ARR | NN, copied at submission |

This is a historical copy, not another reference. Do not connect snapshot fields to services. Presence rules: absent in DRAFT; after submission present exactly when serviceId is present.

## 6. Enum catalog

Use one note per domain near the corresponding boxes. Store allowed strings in each enum field's settings as well; a note alone does not constrain data.

| Enum label | Allowed values | Used by |
|---|---|---|
| UserRole | USER, CREATOR, ADMIN | users.role |
| UserStatus | ACTIVE, SUSPENDED, DELETED | users.status |
| Locale | ko, en | users.preferredLocale |
| CreatorAvailability | AVAILABLE, BUSY, UNAVAILABLE | creatorProfiles.availability |
| ProfileStatus | DRAFT, PUBLISHED, HIDDEN | creatorProfiles.status |
| ProjectStatus | DRAFT, PUBLISHED, ARCHIVED | portfolioProjects.status |
| ServiceStatus | DRAFT, ACTIVE, PAUSED, ARCHIVED | services.status |
| PricingType | STARTING_AT, CUSTOM_QUOTE | services.pricingType; serviceSnapshot.pricingType |
| Currency | KRW | services.currency; inquiries.currency; serviceSnapshot.currency |
| MediaType | IMAGE, VIDEO | portfolioProjects.media.type |
| CommentStatus | ACTIVE, HIDDEN, DELETED | projectComments.status |
| InquiryStatus | DRAFT, SENT, IN_DISCUSSION, DECLINED, CLOSED, CANCELLED | inquiries.status; inquiryEvents.fromStatus and toStatus |
| InquiryOutcome | AGREED_TO_PROCEED, NOT_PROCEEDING, NO_RESPONSE | inquiries.outcome |
| InquiryEventType | SUBMITTED, MESSAGE_SENT, DECLINED, CLOSED, CANCELLED | inquiryEvents.type |
| AuthTokenPurpose | EMAIL_VERIFY, PASSWORD_RESET | authTokens.purpose |
| AuthProvider | EMAIL, PHONE, GOOGLE, TELEGRAM, KAKAO | authIdentities.provider |
| ActivityEventType | PROJECT_PUBLISHED, PROJECT_LIKED, PROJECT_COMMENTED, CREATOR_FOLLOWED | activityEvents.type |
| ActivityDeliveryStatus | PENDING, PROCESSING, COMPLETE | activityEvents.deliveryStatus |

CREATOR includes regular user permissions. There is no stored VISITOR or CLIENT role. There is no stored notification status; missing readAt means unread. There is no generic targetType/targetId pair whose destination changes by enum.

## 7. Exact relationship register

For each row, click Reference, then the parent `_id`, then the existing child reference field. This prevents unwanted duplicate reference fields. Set the end cardinalities explicitly. [Moon Modeler reference instructions](https://www.datensen.com/products/moon-modeler/solutions/mongodb/references-in-diagrams-for-mongodb/)

Read the two cardinality columns separately. For example, `1` parent per child and `0..*` children per parent means every child belongs to exactly one parent, while a parent may have no children.

| ID | Parent collection | Child reference field | Parents per child | Children per parent | Line label |
|---|---|---|---|---|---|
| R01 | users | creatorProfiles.userId | 1 | 0..1 | owns profile |
| R02 | categories | creatorProfiles.categoryIds | 0..5 | 0..* | specializes in; array reference |
| R03 | creatorProfiles | portfolioProjects.creatorId | 1 | 0..* | publishes work |
| R04 | categories | portfolioProjects.categoryId | 0..1 | 0..* | classifies work |
| R05 | creatorProfiles | services.creatorId | 1 | 0..* | offers service |
| R06 | categories | services.categoryId | 0..1 | 0..* | classifies service |
| R07 | users | projectLikes.userId | 1 | 0..* | likes |
| R08 | portfolioProjects | projectLikes.projectId | 1 | 0..* | receives like |
| R09 | users | savedProjects.userId | 1 | 0..* | saves |
| R10 | portfolioProjects | savedProjects.projectId | 1 | 0..* | is saved |
| R11 | users | projectComments.userId | 1 | 0..* | writes comment |
| R12 | portfolioProjects | projectComments.projectId | 1 | 0..* | has comment |
| R13 | users | inquiries.clientId | 1 | 0..* | sends inquiry |
| R14 | creatorProfiles | inquiries.creatorId | 1 | 0..* | receives inquiry |
| R15 | services | inquiries.serviceId | 0..1 | 0..* | selected service |
| R16 | users | inquiries.closedById | 0..1 | 0..* | closes inquiry |
| R17 | inquiries | inquiryMessages.inquiryId | 1 | 0..* | contains message |
| R18 | users | inquiryMessages.senderId | 1 | 0..* | sends message |
| R19 | inquiries | inquiryEvents.inquiryId | 1 | 0..* | has event |
| R20 | users | inquiryEvents.performedById | 1 | 0..* | performs event |
| R21 | inquiryMessages | inquiryEvents.messageId | 0..1 | 1 | records message event |
| R22 | users | notifications.recipientId | 1 | 0..* | receives notification |
| R23 | inquiryEvents | notifications.inquiryEventId | 0..1 | 1 | produces inquiry notification |
| R24 | users | authSessions.userId | 1 | 0..* | has session |
| R25 | authIdentities | authTokens.authIdentityId | 1 | 0..* | verifies or resets EMAIL identity |
| R26 | users | authIdentities.userId | 1 | 1..5 | has login methods |
| R27 | authIdentities | authSessions.authIdentityId | 1 | 0..* | authenticates session |
| R28 | users | creatorFollows.followerId | 1 | 0..* | follows creator |
| R29 | creatorProfiles | creatorFollows.creatorId | 1 | 0..* | has follower |
| R30 | users | activityEvents.performedById | 1 | 0..* | performs public activity |
| R31 | creatorProfiles | activityEvents.creatorId | 1 | 0..* | activity concerns creator |
| R32 | portfolioProjects | activityEvents.projectId | 0..1 | 0..* | activity concerns project |
| R33 | projectComments | activityEvents.commentId | 0..1 | 1 | records comment creation |
| R34 | activityEvents | notifications.activityEventId | 0..1 | 0..* | produces activity notifications |

R02 is conceptually many-to-many, physically an array of ObjectIds in the creator profile. If the tool only offers one/many endpoints, show many and annotate `0..5 distinct; at least 1 when published`. Do not create a junction collection in addition to the array. MongoDB can use references for independently managed related entities. [MongoDB reference modeling](https://www.mongodb.com/docs/v7.0/data-modeling/referencing/)

R04 and R06 permit no category for a draft, but require exactly one active category at publication/activation. Record those conditional rules as notes.

R21, R23, R26, and R33 show committed application invariants. Each user has 1..5 retained identities; a usable method is an additional business rule. If the endpoint cannot express 1..5, show many and annotate the exact bound. Each new comment has one creation event. Each inquiry event has one notification, while an activity event can have none or many. Each notification references exactly one event family. R23 and R34 therefore both show 0..1 parents per notification, with their exclusive-choice rule in a note. Their mandatory child existence is enforced by the transaction described below, not by MongoDB foreign keys. A notification is marked read but not individually deleted in version 1. Do not show cascading database foreign-key actions; MongoDB does not implement those relationships for you.

## 8. Index register

Create these indexes in the collection's Indexes section. `1` means ascending and `-1` descending. Field order is significant. A compound unique index applies to the combination, not to each field individually. [Moon Modeler index instructions](https://www.datensen.com/products/moon-modeler/solutions/mongodb/mongodb-indexes-schema-design/)

### Uniqueness and expiration

| Collection | Index name | Ordered fields | Options |
|---|---|---|---|
| creatorProfiles | uq_profiles_user | userId:1 | unique |
| creatorProfiles | uq_profiles_slug | slug:1 | unique |
| categories | uq_categories_slug | slug:1 | unique |
| portfolioProjects | uq_projects_creator_slug | creatorId:1, slug:1 | unique |
| projectLikes | uq_likes_user_project | userId:1, projectId:1 | unique |
| savedProjects | uq_saves_user_project | userId:1, projectId:1 | unique |
| inquiryMessages | uq_messages_sender_key | senderId:1, clientMessageKey:1 | unique |
| inquiryEvents | uq_events_inquiry_version | inquiryId:1, version:1 | unique |
| inquiryEvents | uq_events_message | messageId:1 | unique; partialFilterExpression: { messageId: { $type: 'objectId' } } |
| notifications | uq_notifications_inquiry | inquiryEventId:1 | unique; partialFilterExpression: { inquiryEventId: { $type: 'objectId' } } |
| notifications | uq_notifications_activity_recipient | recipientId:1, activityEventId:1 | unique; partialFilterExpression: { activityEventId: { $type: 'objectId' } } |
| authIdentities | uq_identities_provider_subject | provider:1, providerSubject:1 | unique; PHONE values normalized before writes |
| authIdentities | uq_identities_user_provider | userId:1, provider:1 | unique; one retained method per provider per user |
| creatorFollows | uq_follows_user_creator | followerId:1, creatorId:1 | unique; reuse inactive pair on re-follow |
| projectComments | uq_comments_user_key | userId:1, clientCommentKey:1 | unique; retry deduplication |
| activityEvents | uq_activity_performer_key | performedById:1, actionKey:1 | unique; retry must match type and target |
| activityEvents | uq_activity_first_publication | projectId:1 | unique; partialFilterExpression: { type: 'PROJECT_PUBLISHED' } |
| activityEvents | uq_activity_comment | commentId:1 | unique; partialFilterExpression: { type: 'PROJECT_COMMENTED' } |
| authSessions | uq_sessions_token | refreshTokenHash:1 | unique |
| authTokens | uq_tokens_hash | tokenHash:1 | unique |
| authSessions | ttl_sessions_expiry | expiresAt:1 | expireAfterSeconds: 0 |
| authTokens | ttl_tokens_expiry | expiresAt:1 | expireAfterSeconds: 0 |

The messageId index is partial because non-message events omit messageId. A plain unique index on that optional field would interfere with multiple events lacking a value. [MongoDB partial unique indexes](https://www.mongodb.com/docs/v8.0/core/index-partial/)

The partial inquiry notification index preserves one recipient per inquiry event. The partial activity index permits many recipients for one activity event but only one notification for each recipient. Both indexes are needed. Do not create the old global unique eventId index.

Do not use a partial unique index to allow duplicate slugs or login identities after soft deletion in this version. Their reservation is intentional.

### Query indexes

These are initial candidates tied to actual screens. Recheck query plans and remove redundant indexes when implementing. The `_id` tie-breaker supports stable pagination where listed.

| Collection | Index name | Ordered fields | Query |
|---|---|---|---|
| creatorProfiles | ix_profiles_discovery | status:1, categoryIds:1, city:1, remoteAvailable:1 | Category-led discovery; one array field only |
| creatorProfiles | ix_profiles_city | status:1, city:1, remoteAvailable:1 | City discovery without category |
| categories | ix_categories_active_order | isActive:1, sortOrder:1, _id:1 | Category picker |
| portfolioProjects | ix_projects_feed | status:1, publishedAt:-1, _id:-1 | Latest public work |
| portfolioProjects | ix_projects_creator | creatorId:1, status:1, publishedAt:-1, _id:-1 | Creator portfolio |
| portfolioProjects | ix_projects_category | categoryId:1, status:1, publishedAt:-1, _id:-1 | Category feed |
| services | ix_services_creator | creatorId:1, status:1, _id:1 | Creator's service list |
| services | ix_services_category | categoryId:1, status:1, _id:1 | Service discovery |
| projectLikes | ix_likes_project | projectId:1 | Like count for a project |
| savedProjects | ix_saves_user_recent | userId:1, createdAt:-1, _id:-1 | Private saved-work list |
| projectComments | ix_comments_project | projectId:1, status:1, createdAt:-1, _id:-1 | Visible comments |
| inquiries | ix_inquiries_client | clientId:1, updatedAt:-1, _id:-1 | Client inbox and drafts |
| inquiries | ix_inquiries_creator | creatorId:1, status:1, updatedAt:-1, _id:-1 | Creator inbox by status, excluding drafts |
| inquiryMessages | ix_messages_timeline | inquiryId:1, createdAt:1, _id:1 | Conversation timeline |
| inquiryMessages | ix_messages_unread | inquiryId:1, readAt:1, senderId:1 | Unread messages from other participant |
| notifications | ix_notifications_inbox | recipientId:1, createdAt:-1, _id:-1 | Complete notification inbox |
| notifications | ix_notifications_unread | recipientId:1, readAt:1, createdAt:-1, _id:-1 | Unread notification list |
| authSessions | ix_sessions_user | userId:1, revokedAt:1 | List/revoke user sessions |
| authTokens | ix_tokens_identity_purpose | authIdentityId:1, purpose:1 | Invalidate verification/reset tokens |
| authSessions | ix_sessions_identity | authIdentityId:1, revokedAt:1 | Revoke sessions after unlink |
| creatorFollows | ix_follows_creator_delivery | creatorId:1, isActive:1, followerId:1 | Page active followers; also filter followedAt at delivery |
| creatorFollows | ix_follows_user_recent | followerId:1, isActive:1, followedAt:-1, _id:-1 | User's following list |
| activityEvents | ix_activity_delivery | deliveryStatus:1, nextAttemptAt:1, createdAt:1, _id:1 | Pending notification jobs |
| activityEvents | ix_activity_expired_lease | deliveryStatus:1, leaseUntil:1 | Recover crashed delivery workers |

Use the existing inquiryId + version index to read inquiry history in version order. Do not add a duplicate inquiry-event timeline index. Public queries still filter deletedAt and owner visibility; an index does not enforce those conditions. These B-tree indexes do not implement semantic search, arbitrary text search, or every optional filter combination.

## 9. Inquiry lifecycle and consistency

| Current state | Action | Performed by | Next state | Event |
|---|---|---|---|---|
| DRAFT | Edit draft | Client | DRAFT | None |
| DRAFT | Submit reviewed inquiry | Client | SENT | SUBMITTED |
| SENT | Send follow-up message | Client | SENT | MESSAGE_SENT |
| SENT | Send first reply | Creator owner | IN_DISCUSSION | MESSAGE_SENT |
| SENT | Decline | Creator owner | DECLINED | DECLINED |
| SENT | Cancel | Client | CANCELLED | CANCELLED |
| SENT | Close with outcome | Client | CLOSED | CLOSED |
| IN_DISCUSSION | Send message | Either participant | IN_DISCUSSION | MESSAGE_SENT |
| IN_DISCUSSION | Close with outcome | Either participant | CLOSED | CLOSED |
| DECLINED, CANCELLED, CLOSED | Read history | Either participant | Unchanged | None |

No messages or state changes are allowed in terminal states. Draft deletion is a hard delete with no event because no conversation has been submitted. No reopening in version 1.

Closing requires an InquiryOutcome. AGREED_TO_PROCEED is allowed only from IN_DISCUSSION and records the closing participant's report, not a verified contract. NOT_PROCEEDING is allowed from SENT or IN_DISCUSSION. NO_RESPONSE is available from SENT only to the client, at least seven days after submittedAt; it is not set by a background job. Decline and cancel omit outcome. All terminal actions set closedAt and closedById.

Every inquiry-event-producing operation uses one database transaction to:

1. Check the authenticated actor, participants, account state, expected inquiry version, and current status.
2. Create the message if applicable, including its retry key.
3. Update the inquiry, increment version, and set the appropriate dates/status.
4. Insert one inquiryEvents record using the resulting version.
5. Insert one notification for the other participant using inquiryEventId. Public activity notifications follow section 17 instead.

Only commit if all writes succeed. This requires a transaction-capable MongoDB deployment, such as a replica set. The diagram records the intended invariant; implementation and tests still have to prove it.

If two actions race, one version-conditional update succeeds and the other reloads the record before proceeding. A message retry returns the original accepted message. A repeated submission of the same already-submitted draft returns the existing submission when appropriate and never produces another SUBMITTED event. Do not interpret this as permission to create a new inquiry on every retry.

Submission captures serviceSnapshot in that same transaction. Check the currently accepted service version/status as part of the submission operation; define the snapshot as the service data read by that transaction. A later service edit or pause does not rewrite a committed inquiry.

MongoDB indexes enforce unique keys. Mongoose's `unique` option describes an index, not an ordinary validation rule, and update validation has limitations. Build indexes deliberately and validate complete state transitions in the service layer. [Mongoose validation documentation](https://mongoosejs.com/docs/validation)

## 10. Deletion, visibility, and ownership notes

Profile owners may move DRAFT to PUBLISHED after publication checks, PUBLISHED to HIDDEN, and HIDDEN back to PUBLISHED after revalidation. Projects move DRAFT to PUBLISHED, PUBLISHED to ARCHIVED, or ARCHIVED back to PUBLISHED after revalidation. Services move DRAFT to ACTIVE after activation checks, ACTIVE to PAUSED or ARCHIVED, PAUSED to ACTIVE or ARCHIVED, and ARCHIVED to ACTIVE after revalidation. Do not return published content to DRAFT. Keep the original publishedAt when republishing. Soft-deleted records cannot be republished in version 1.

Users start ACTIVE. Administrators may suspend and reactivate accounts. A user may request deletion of their own account. DELETED is terminal in version 1, with no self-service restore. Only an administrator can restore a HIDDEN comment to ACTIVE; DELETED comments cannot be restored. Authors can delete their comments even if hidden. All writes still require an active authorized actor, so a suspended owner cannot use publication changes to restore public access.

| Record | Version 1 behavior |
|---|---|
| User | Set DELETED and deletedAt; revoke login identities, sessions, and tokens; remove access; public queries exclude the owner and their content. Historical reference records remain. |
| Creator profile | Set deletedAt; keep userId and slug; do not transfer ownership. Existing inquiries remain accessible to an active owner. |
| Project/service | Set deletedAt; preserve references; prevent new interactions or service selection. |
| Category | Set isActive false; never hard-delete a referenced category. |
| Like/save | Hard-delete on unlike/unsave; no audit required for this scope. |
| Comment | Set DELETED and deletedAt; omit content from public output. Admin hiding uses HIDDEN without deletedAt. |
| Draft inquiry | Client may hard-delete it; drafts have no messages, events, or notifications. |
| Submitted inquiry | No delete endpoint. Close/decline/cancel using the lifecycle. |
| Message/event | Immutable, retained with its submitted inquiry. readAt is the only mutable message field. |
| Notification | Recipient can mark read; retain it and recheck target visibility. |
| Login identity | Revoke without releasing its unique provider/subject. Never unlink the last usable method. |
| Creator follow | Set isActive false on unfollow. Re-follow updates followedAt on the same unique pair. |
| Activity event | Retain immutable action fields; only delivery progress changes. Hidden targets render unavailable and are excluded from pending delivery. |
| Auth session/token | Revoke/consume immediately when appropriate; expiration cleanup by TTL. |

Soft deletion is not a promise of permanent data erasure. Production retention, anonymization, backup deletion, and moderation-access policies are separate decisions. Do not claim these are implemented by deletedAt.

Archived/hidden/deleted status must be checked on detail endpoints as well as list endpoints. Knowing a MongoDB ID or an old URL must not bypass visibility or participant checks. Do not allow changing creatorId, userId, clientId, or senderId after creation.

## 11. What the AI assistant uses

The AI branch in the workflow does not require an `ai` entity. In version 1 it translates a visitor's request into structured filters and searches existing public data:

| User's need | Fields used |
|---|---|
| Creative discipline | categories, creatorProfiles.categoryIds, services.categoryId |
| Location/remote work | creatorProfiles.city, remoteAvailable |
| Skills and evidence | creatorProfiles.skills, portfolioProjects.title/summary/tags |
| Offering/budget | services.title/description/pricingType/startingPrice/currency |
| Availability | creatorProfiles.availability |

For a budget request, CUSTOM_QUOTE means unknown price, not zero. Recommendations explain that a quote is needed. Before displaying a recommendation, resolve its IDs and recheck public visibility. Private inquiries, emails, password hashes, sessions, and saved-project lists are never included in public discovery results.

If persistent assistant chats, vector search, or recommendation analytics are added, make a separate model revision with retention and access rules. Do not draw placeholder collections with no defined behavior.

## 12. Manual Moon Modeler build order

### Step 1. Save the working copy

Open the original editable Nestar model if available and save a separate project named `CreatorHub v1`. If only the screenshot exists, create a new MongoDB project. The screenshot is a visual reference, not an editable model file. Use MongoDB mode for this field dictionary. Mongoose mode has different property settings; do not mix the two types in one model.

### Step 2. Add the diagram legend

Create a note listing NN, UQ, REF, array notation, optional-field semantics, UTC dates, and the numeric storage caveat. Add `Proposed design v1.2, 2026-09-26` to the diagram title. Include a note that CREATOR is an account role; ACTIVE is an account status; PUBLISHED is a creator-profile status.

### Step 3. Create the 17 collection boxes

Create them in this order: users, authIdentities, categories, creatorProfiles, portfolioProjects, services, creatorFollows, projectLikes, savedProjects, projectComments, inquiries, inquiryMessages, inquiryEvents, activityEvents, notifications, authSessions, authTokens. Enter `_id: ObjectId, NN` first in every box.

### Step 4. Enter fields

Copy each dictionary table in order. Turn NN on only for unconditional required fields. Keep conditional fields optional and add their condition to the description. For arrays, set the item type and ARR. A required array may be empty unless a rule says otherwise. [Moon Modeler field and array setup](https://www.datensen.com/products/moon-modeler/solutions/mongodb/mongodb-schema-design/)

### Step 5. Add the enum values and defaults

Use section 6 for every enum. Enter defaults as documented behavior and use native default settings only if supported by the selected project type. Add readable enum notes next to the related group. Do not make roles or statuses into collections.

### Step 6. Add the three embedded object definitions

Use Object plus ARR for socialLinks and media, and Object without ARR for serviceSnapshot. Define their child fields and show containment lines. Moon Modeler represents embedded objects separately on the canvas while they remain inside their parent documents. [Embedded object setup](https://www.datensen.com/products/moon-modeler/solutions/mongodb/mongodb-schema-design/)

### Step 7. Connect existing reference fields

Follow R01–R34. Draw from parent `_id` to the existing child field. Keep two distinct lines when the same collection appears in different roles, such as inquiries.clientId and inquiries.closedById. Label each line with its role. Do not create duplicate fields when a line is added.

### Step 8. Set both ends of every relationship

Use the register's parents-per-child and children-per-parent columns. Do not assume every line is one-to-many. Check R01, R02, R04, R06, R15, R16, R21, and R23 especially. Add text notes when a conditional or bounded relationship exceeds the tool's endpoint choices.

### Step 9. Enter indexes

Add uniqueness and TTL indexes first. Apply every listed partial condition, including inquiryEvents, activityEvents, and both notification indexes. Then add the initial query indexes. Do not apply UQ separately to both fields of a compound key.

### Step 10. Attach rule notes

Place the permission matrix near users, the publication rules near discovery, and the inquiry lifecycle and transaction rule near inquiries. Add brief deletion notes to affected collections. Long explanations belong in this companion guide rather than tiny text inside collection boxes.

### Step 11. Arrange the diagram

Use orange headers for users, creatorProfiles, portfolioProjects, services, and inquiries. Use blue for supporting product collections. Use a subdued third color for authIdentities, authSessions, and authTokens. Keep enum notes visually distinct from collections.

Place accounts on the left, categories above the center, profiles/projects/services in the center, engagement below projects, and inquiries/messages/events/notifications on the right. Place authentication below users. Keep embedded object boxes near their parent and route reference lines around boxes.

If the installed edition supports sub-diagrams, use an overview plus Accounts, Discovery, and Inquiry detail views. Otherwise export readable crops or separate documented detail views. Never duplicate physical collections just to simplify the picture.

### Step 12. Review and export

Work through section 13. Save the editable project and export the full diagram plus readable detail images. Inspect the actual exports at normal reading size; do not accept unreadable text just because the whole model fits on one page. Keep this guide beside the exported diagrams in the portfolio repository.

## 13. Acceptance checklist

### Structural review

- [ ] There are exactly 17 collection boxes and three embedded-object definitions.
- [ ] UserRole contains USER, CREATOR, ADMIN; UserStatus remains ACTIVE, SUSPENDED, DELETED.
- [ ] First profile publication and creator promotion are one transaction. ADMIN retains its role.
- [ ] Role checks never replace ownership, visibility, usable-login-identity, or active-account checks.
- [ ] PHONE registration has a password and unique normalized number, but no SMS or verifiedAt.
- [ ] EMAIL/PHONE hashes are conditional fields in authIdentities; social methods have none.
- [ ] Notifications have exactly one event reference and both partial unique indexes.
- [ ] Only first project publication alerts followers; profile/service edits do not.
- [ ] Every collection has one `_id` and its existing unique identifier.
- [ ] Every ObjectId reference field appears once in R01–R34.
- [ ] No scalar ObjectId is connected to several unrelated target collections.
- [ ] categoryIds is an array reference, not an extra collection or scalar reference.
- [ ] Each enum field uses the catalog values and its documented default, if any.
- [ ] Optional fields are distinct from required fields and conditional requirements.
- [ ] All unique, partial, and TTL index settings match the register.
- [ ] Reference lines point to existing fields, with no automatically added duplicate IDs.
- [ ] Embedded objects use containment lines, not independent collection references.
- [ ] No unused Nestar property, article, agent, rent, barter, or ranking fields remain.

### Scenario walkthroughs

| Scenario | Expected result |
|---|---|
| Register twice with equivalent normalized email or phone | Unique provider/subject index prevents duplicate identities, even concurrently |
| Register by phone and password | No SMS is sent; verifiedAt remains absent; usable login succeeds |
| Register with only Google, Telegram, or Kakao | No local password or email is required; backend validates provider proof |
| Link another provider while signed in | New identity points to the same user and creator profile |
| Provider reports the same email as another account | No automatic merge or linking |
| Unlink last usable identity | Rejected |
| Follow a creator twice | One active pair, no duplicate new-follower event |
| Follow then unfollow before delivery | Pending project alerts skip this user |
| Publish a project's first public version | One publication event; eligible followers receive at most one notification each |
| Edit profile/service or republish archived work | No follower alert |
| Create a like/comment on another creator's project | Creator gets an activity notification; retries do not duplicate it |
| Restart a crashed activity worker | Lease recovery and recipient/event uniqueness prevent lost checkpoints or duplicates |
| Notification has both event IDs or neither | Rejected by backend validation |
| Create a second profile for the same user | Unique userId rejects it |
| Start creator onboarding | USER remains USER with one DRAFT profile |
| Publish a valid first creator profile | One transaction sets CREATOR and PUBLISHED; role remains ADMIN for an admin |
| Fail or retry first publication | No partial role/profile change; retry reuses the same profile |
| CREATOR sends an inquiry to another creator | Allowed under regular inquiry rules |
| USER with only a draft tries to create a service | Rejected until creator publication succeeds |
| Hide or soft-delete a creator profile | Role remains CREATOR; visibility and creation restrictions follow profile state |
| ADMIN with a profile performs creator work | Allowed only on owned records; private conversations still require participation |
| Save a profile/project draft with incomplete publication fields | Allowed if base required fields are valid |
| Publish without category or portfolio media | Rejected by publication rules |
| Select the same category twice in a profile | Rejected by array validation |
| Like the same project twice concurrently | One like document; stable final liked state |
| Save work, then the creator hides it | Saved reference can remain; private content is not exposed |
| Submit a direct inquiry | serviceId and serviceSnapshot both absent |
| Submit an inquiry for another creator's service | Rejected |
| Edit a service after inquiry submission | Snapshot remains unchanged |
| Send the same message twice with one retry key | One message, one event, one notification |
| Reuse the message key with different content | Conflict rejected |
| Message and closure happen concurrently | Version check prevents a message committed after closure |
| Creator sends first reply | Status becomes IN_DISCUSSION with one MESSAGE_SENT event |
| Client reads their own sent message | Does not set readAt |
| Unrelated signed-in user opens an inquiry ID | Access denied |
| Client cancels a SENT inquiry | CANCELLED, terminal dates/actor set, other participant notified |
| Close without outcome | Rejected |
| Delete a creator profile with existing inquiries | References preserved; public listing removed |
| Use an expired reset token still present before TTL cleanup | Rejected immediately by the backend |
| Logout or suspend an account | Protected access is rejected through session/account checks |
| AI suggests a hidden or nonexistent project | Visibility/ID validation excludes it |

These are design acceptance scenarios, not tests already executed against an implemented CreatorHub backend.

## 14. Adapting Nestar after the model is complete

| Nestar source | CreatorHub treatment |
|---|---|
| Member model and account services | Refactor to users; separate creatorProfiles; replace AGENT with CREATOR and check linked profile ownership |
| Property model | Replace with independent portfolioProjects and services designs; do not rename propertyPrice into a portfolio field |
| BoardArticle | Omit the separate board module for this workflow |
| Like/Comment | Use explicit project references; remove polymorphic group/refId pairs |
| View | Omit until view analytics and visitor identity are specified |
| Follow | Use creatorFollows linking follower user to creator profile; first-publication alerts only |
| Notice | Omit platform announcements from the initial product scope |
| Notification | Use recipientId and exactly one of inquiryEventId/activityEventId |
| New modules | Categories, saves, inquiries, messages, inquiry/activity events, auth identities, sessions, and email tokens |

The source archive `creatorhub-backend-starter.zip` remains a Nestar starting copy. No source-code refactor is part of this modeling guide. When implementation begins, update models, DTOs, GraphQL types, validation, authorization, query filters, indexes, services, and tests together. An edited diagram alone does not change backend behavior.

For portfolio presentation, explain why portfolios differ from services, why CREATOR includes regular user abilities and still requires profile ownership, why messages are separate documents, and why each state-changing action has a transaction and event history. Describe what you adapted from the starter and what you designed yourself.

## 15. Remaining implementation choices

The model is ready for manual entry under the assumptions above. Section 16 records the chosen login behavior; section 17 records notifications. These choices do not need placeholder collections, but must be resolved before claiming a production-ready implementation:

- Configure provider clients, callback URLs, email delivery, abuse limits, and a password policy before implementation. Phone registration explicitly has no SMS confirmation.
- Define support handling for disputed/unverified phone numbers and recovery when the only password is lost. The schema does not prove number ownership.
- Define the canonical location list and translated city labels used by the filter.
- Choose media storage and allowed upload/link formats.
- Verify numeric BSON serialization and the installed Moon Modeler project's generated validation syntax.
- Choose the AI retrieval approach and evaluate it on Korean and English requests.
- Define operational retention, account erasure, and support-access policies.
- Benchmark the actual list/filter queries before finalizing all query indexes.

No ER diagram alone proves application correctness. The completion standard is a consistent model, explicit product assumptions, and an implementation that passes the acceptance scenarios.

## 16. Registration, login, and linked identities

### Chosen registration methods

| Method | User enters or approves | Stored providerSubject | PasswordHash | Verification and usability |
|---|---|---|---|---|
| PHONE | Country code, phone number, password, display name | Canonical international E.164 number, such as +821012345678 | Required | No confirmation message; verifiedAt absent; usable immediately after registration |
| EMAIL | Email, password, display name; then email confirmation link | Trimmed/lowercased email, max 254 characters | Required | usable after EMAIL_VERIFY sets verifiedAt |
| GOOGLE | Google login consent | Validated Google sub string | Absent | usable after server validates provider login; set verifiedAt |
| TELEGRAM | Telegram login consent | Validated Telegram OIDC sub string | Absent | usable after server validates provider login; set verifiedAt |
| KAKAO | Kakao login consent | Validated Kakao OIDC sub string for the configured app | Absent | usable after server validates provider login; set verifiedAt |

A usable identity is unrevoked and either PHONE, verified EMAIL, or a successfully validated social identity. All protected product actions also require an ACTIVE user. Email-only users awaiting confirmation can use a restricted verification/resend flow, not ordinary protected product actions. Account status remains independent of verification.

Phone parsing uses an explicit country selection and a phone-number parser, not just removing punctuation. Equivalent accepted formats become the same E.164 string before lookup and insertion. The unique provider + providerSubject index is the final duplicate guard. A pre-insert lookup alone is insufficient under concurrent registration. Phone strings are never numbers: leading plus and digits must be preserved. This design sends no SMS and never labels PHONE as verified.

### One account, several ways to sign in

For example, Mina's users._id is U1. Her PHONE identity stores userId U1, provider PHONE, providerSubject +821012345678, and a password hash. If she links Google, another identity stores userId U1, provider GOOGLE, and Google's sub; no password hash. Both open the same account and creator profile.

Registration creates user + identity in one transaction. For social login, a known provider/subject signs into its existing user. An unknown identity may create a new USER only after explicit registration consent and completion of required display-name fields. Treat provider names/photos as suggestions and validate before storing. Concurrent callbacks must converge through unique indexes rather than leaving orphan accounts.

Linking requires an already signed-in user, recent reauthentication with an existing usable method, and successful authentication of the new method. For PHONE this means choosing a unique number and password, not proving number ownership. For EMAIL it means confirming the email. Link confirmation tokens apply to the exact pending EMAIL identity owned by that user. Never silently merge accounts based on matching email, phone, display name, or provider claims. If the method is already linked to another user, reject linking. Provider-returned phone/email does not automatically create a PHONE/EMAIL login identity.

Unlinking sets revokedAt, invalidates that identity's tokens, and revokes its sessions in a transaction. Serialize account-level link/unlink operations so concurrent removals cannot remove every usable method. Do not unlink the last usable method. Relinking a retained method requires the same account and the same authentication checks. Pending EMAIL alone does not count as recovery or a remaining usable method.

Passwords are hashed before storage and verified by the backend. EMAIL and PHONE each have their own local password hash if both are linked; changing one does not silently change the other. A reset email can reset only the verified EMAIL identity it names. After authenticating through another linked method and recent reauthentication, the owner can replace a PHONE password, revoking existing sessions. A phone-only user who loses the password has no automated recovery in this version. Do not invent SMS recovery or accept an unverified phone claim as recovery proof.

### Provider configuration and proof

Use one configured application identity namespace per provider in this model. If multiple independent provider apps are introduced, explicitly model issuer/client namespace before assuming subjects are globally interchangeable.

Google identifies accounts by sub rather than email. The backend verifies signed login proof, audience, issuer, expiry, and the authorization request binding. [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

Telegram supports OpenID Connect. Configure its bot, allowed URLs, and client credentials; validate its ID token and use sub. Requesting phone sharing or permission to send Telegram messages is optional and unnecessary for this login-only scope. [Telegram login](https://core.telegram.org/bots/telegram-login).

Use Kakao Login with OpenID Connect enabled for the configured app. The website button may say "Continue with Kakao". Kakao email/phone availability depends on user data and consent, so neither is mandatory for a KAKAO identity. [Kakao login API](https://developers.kakao.com/docs/en/kakaologin/rest-api), [Kakao consent and missing contact information](https://developers.kakao.com/docs/en/kakaologin/faq).

Keep authorization state, nonce, and any PKCE verifier in a short-lived server-side authentication transaction store bound to the initiating browser and intended sign-in/link action. Validate redirects, signatures, issuer, audience, expiry, nonce, state, and replay protection as appropriate to the provider flow. This transient store is infrastructure, not a new product collection. Do not persist provider access/refresh tokens for login-only use. Client secrets never appear in the ER data or browser code.

## 17. Follows, likes, comments, and notification delivery

### Exactly what triggers an alert

| Action | ActivityEventType | Recipient |
|---|---|---|
| Project is published for the first time | PROJECT_PUBLISHED | Eligible active followers of its creator |
| User creates a new project like | PROJECT_LIKED | Project creator's account |
| User creates a new project comment | PROJECT_COMMENTED | Project creator's account, unless also the author |
| User starts or resumes following a creator | CREATOR_FOLLOWED | Creator's account |
| Profile edit, service change, project edit, or archive/republish | None | Nobody |
| Unlike, unfollow, comment edit/delete/hide | None | Nobody |

Follower alerts are only for first publication of projects, as requested. Likes/comments remain attached to portfolioProjects, not profiles or services. Comments are flat, without replies. New-follower and like/comment alerts go to the creator, not that creator's followers. Activity notifications always exclude the actor. Public activity notification delivery is in-app only.

### Write the action and event together

In one transaction, validate actor/account and target visibility/ownership, make the source change, and insert the matching activityEvents record with PENDING status. First publication additionally requires publishedAt to have been absent and sets it once. The partial publication index makes one event per project's first publication possible. Do not create another event on retries or republication. Comments use userId + clientCommentKey to reuse the original comment on matching retries. The event uses the same request UUID as actionKey where applicable.

A repeated actor/actionKey must match its original action and target. For comment retries, it must also match the original content. Reusing a key for a different request is rejected. A like/follow request in the already-requested state makes no new event. Concurrent like/unlike or follow/unfollow operations must serialize on their source state and retain the original accepted response for event-producing retries. New like/follow cycles can produce new alerts; rate limits prevent notification spam.

### Deliver without losing or duplicating notifications

A worker claims PENDING events when nextAttemptAt is due, sets PROCESSING and leaseUntil, and increments attempts. Expired PROCESSING leases can be reclaimed. Errors return the event to PENDING with a delayed nextAttemptAt. The worker renews its lease while processing. Each claim uses its exact leaseUntil value as a compare-and-set ownership condition for renewals, checkpoints, retries, and completion. A stale worker must stop if another worker has replaced that lease. Repeated failures require operational attention; do not mark incomplete work COMPLETE.

For a publication, scan creatorFollows in followerId order. A recipient must have an ACTIVE account, an active follow whose followedAt is strictly before the event's createdAt, and must not be the actor. The project and creator must still be public. Recheck current follow and visibility before delivery. New follows after publication do not receive older alerts. Unfollow/re-follow after publication resets followedAt and therefore does not qualify for that older event. Events with no eligible recipients still complete.

Each batch inserts notifications using unique recipientId + activityEventId keys and updates deliveryCursor in the same transaction. The cursor stores the last scanned followerId as an opaque string. Skip ineligible recipients while still advancing the cursor. Retry-safe upserts and the unique index handle duplicate worker attempts. A cursor advances only after its batch commits. Mark COMPLETE and set completedAt after the final batch. Do not store all followers in an unbounded array.

For like/comment/follow events, resolve the target creator's userId as the single possible recipient. Check current source state: the like still exists, the comment is ACTIVE, or the follow is active, respectively; otherwise skip pending delivery. Skip an inactive recipient, unavailable public target, or the actor. Insert the notification and mark completion atomically. These alerts can have zero recipients after such checks.

Inquiry notifications keep their stronger synchronous rule: exactly one per inquiry event in the original inquiry transaction. Public activity delivery is asynchronous and may produce zero, one, or many notifications. Opening any notification rechecks target visibility and participant access. Already delivered alerts may remain after unlike/unfollow, but hidden or deleted content must not be revealed.
