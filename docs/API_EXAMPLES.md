# GraphQL integration examples

Use the development playground at `http://localhost:3001/graphql`. The generated [schema](schema.graphql) lists every argument and output field.

## Register and verify

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    accessToken
    refreshToken
    expiresIn
    user { _id displayName role }
  }
}
```

```json
{
  "input": {
    "email": "creator@example.com",
    "password": "choose-your-own-long-password",
    "displayName": "Seoul Studio"
  }
}
```

Copy the verification token from the delivered email or development mail file, then call:

```graphql
mutation Verify($token: String!) {
  verifyEmail(token: $token)
}
```

Set the playground HTTP headers for authenticated requests:

```json
{ "Authorization": "Bearer <accessToken>" }
```

## Discover public content

```graphql
query Discover($input: DiscoveryInput!) {
  getCreators(input: $input) {
    _id slug headline city remoteAvailable availability
    identity { displayName avatarUrl }
  }
  getProjects(input: $input) {
    _id creatorId title slug coverImageUrl
  }
  getServices(input: $input) {
    _id creatorId title pricingType startingPrice currency
  }
}
```

```json
{ "input": { "city": "seoul", "remoteAvailable": true, "limit": 20, "offset": 0 } }
```

Query `categories { _id slug name }` and `getCities { key nameEn nameKo }` for filter choices. `creatorId` filters project/service lists for a creator page. A `budgetMax` filters services and creator offerings; portfolio projects have no price.

## Create a profile and publish it

```graphql
mutation CreateProfile($input: CreateCreatorInput!) {
  createCreatorProfile(input: $input) { _id slug status }
}
```

```json
{
  "input": {
    "slug": "seoul-studio",
    "headline": "Independent brand designer",
    "city": "seoul",
    "remoteAvailable": true,
    "categoryIds": ["<categoryId>"],
    "skills": ["Brand identity", "Editorial design"]
  }
}
```

```graphql
mutation PublishProfile {
  setCreatorProfileStatus(status: PUBLISHED) { _id status publishedAt }
}
```

Use `createProject` and `createService` for separate work samples and offerings. Publication requires a project's category, description, cover, and media. Service activation requires its category, description, and deliverables. Do not send ownership IDs or account roles in these inputs.

## Review and submit an inquiry

Sign in as a different account from the creator. First save a draft:

```graphql
mutation Draft($input: CreateInquiryInput!) {
  createInquiry(input: $input) { _id version status subject brief }
}
```

```json
{
  "input": {
    "creatorId": "<creatorProfileId>",
    "serviceId": "<optionalServiceId>",
    "subject": "Identity for a new bookstore",
    "brief": "We need a logo and visual guidelines for an independent bookstore.",
    "budgetMin": 500000,
    "budgetMax": 1000000
  }
}
```

For direct contact, omit `serviceId`. The client reviews the draft before calling:

```graphql
mutation Submit($input: InquiryVersionInput!) {
  submitInquiry(input: $input) {
    _id status version submittedAt
    serviceSnapshot { title pricingType startingPrice currency deliverables }
  }
}
```

```json
{ "input": { "inquiryId": "<draftId>", "expectedVersion": 0 } }
```

Use the most recently read `version`; draft edits also increment it. A version conflict means the frontend must reload and reconcile before retrying. Repeated submission of the same already-submitted draft returns its existing submission.

## Reply and close

```graphql
mutation Reply($input: SendMessageInput!) {
  sendInquiryMessage(input: $input) { _id inquiryId senderId body createdAt }
}
```

```json
{
  "input": {
    "inquiryId": "<inquiryId>",
    "expectedVersion": 1,
    "clientMessageKey": "<generate-a-UUID-once-for-this-message>",
    "body": "Thanks for the brief. Can we discuss the launch date?"
  }
}
```

Reuse the same UUID and body when retrying an uncertain message delivery. Use a new UUID for a different message. Fetch `getInquiry(inquiryId: ...)` after a successful reply to obtain the new version. The creator's first reply changes the state to `IN_DISCUSSION`.

```graphql
mutation Close($input: CloseInquiryInput!) {
  closeInquiry(input: $input) { _id status outcome closedAt version }
}
```

```json
{
  "input": {
    "inquiryId": "<inquiryId>",
    "expectedVersion": 2,
    "outcome": "AGREED_TO_PROCEED"
  }
}
```

`AGREED_TO_PROCEED` requires a discussion and records the participant's reported outcome, not a payment or contract. `NO_RESPONSE` is available only to the client after seven days in `SENT`. Decline and cancel have no outcome field. No terminal inquiry can reopen.


## Phone registration without confirmation messages

```graphql
mutation RegisterPhone($input: PhoneRegisterInput!) {
  registerPhone(input: $input) { accessToken refreshToken user { _id role preferredLocale } }
}
```

```json
{
  "input": {
    "phoneNumber": "+821012345678",
    "password": "a-long-private-password",
    "displayName": "Mina"
  }
}
```

Include the country calling code. Formatting is parsed to a valid canonical international number; registration reserves it uniquely and sends no SMS. `loginPhone` accepts phoneNumber and password. Default preferredLocale is en.

## Follow a creator

```graphql
mutation Follow($creatorId: ID!) {
  setCreatorFollow(creatorId: $creatorId, following: true)
}
```

Use the creatorProfiles._id, not users._id. Use following:false to unfollow. First publication of a new project creates the follower alert; ordinary profile/service edits do not.

## Comment retries and notifications

`CommentInput` requires projectId, content, and a UUID-v4 clientCommentKey. Generate the key once per new comment and reuse it on retries. Reusing it with different content is rejected.

```graphql
query MyNotifications {
  getNotifications {
    _id readAt unavailable
    event { _id type inquiryId performedById }
    activityEvent { _id type creatorId projectId commentId performedById }
  }
}
```

Only the recipient can read these results. An inquiry notification has event; a public activity notification has activityEvent. Hidden targets return unavailable:true with no event detail. See README.md for social login and linking operations.
