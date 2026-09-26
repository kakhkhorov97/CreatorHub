# External service contracts

These integrations are configured by environment variables. No provider credentials are included, and no external deployment was performed.

## Email adapter

When `MAIL_WEBHOOK_URL` is set, the backend sends an HTTPS POST with:

```http
Authorization: Bearer <MAIL_WEBHOOK_TOKEN>
Content-Type: application/json
```

Example JSON body:

```json
{
  "to": "creator@example.com",
  "template": "EMAIL_VERIFY",
  "actionUrl": "https://your-frontend.example/verify-email?token=<single-use-token>"
}
```

`template` is `EMAIL_VERIFY` or `PASSWORD_RESET`. The adapter should send the corresponding email and return a successful HTTP status only after accepting delivery. The request timeout is 10 seconds. Redirects are rejected. The backend does not persist an email delivery queue or retry delivery automatically.

Without an adapter in development, messages are written to `.local/mail` with restrictive file permissions. These files contain usable tokens, are ignored by Git, and should be deleted after development use. Verification tokens expire after 24 hours; reset tokens after 30 minutes. Requesting another token invalidates prior unused tokens of the same purpose.

If sending the registration email fails, the unverified account still exists. Use `requestEmailVerification` after fixing delivery. Do not try to create a second account with the same address.

## Media storage

`MEDIA_BASE_URL` is the root of a trusted HTTPS media location. For example:

```text
https://cdn.your-domain.example/creatorhub/<userId>/portfolio-cover.webp
```

The authenticated account must match the path's `userId`. Allowed image extensions are PNG, JPEG/JPG, WebP, and AVIF. Allowed video extensions are MP4 and WebM. URLs containing credentials, a different origin/account path, or encoded path separators are rejected. Portfolio media needs alt text and distinct sort positions. Media is stored outside MongoDB.

The supplied implementation validates media references. It does not issue signed uploads, upload bytes, verify MIME signatures, scan files, check remote object existence, or prove ownership independently of the configured account path. The storage service must restrict writes to the correct account prefix and validate uploaded file contents. Add a provider-specific upload adapter when choosing storage for the frontend.

Social and external portfolio links accept validated HTTPS URLs. The backend does not fetch these URLs.

## AI discovery adapter

Configure `DISCOVERY_PARSER_URL` and `DISCOVERY_PARSER_TOKEN` for an HTTPS endpoint that converts a request into structured filters. Authentication uses the same Bearer header pattern. The request contains:

```json
{
  "request": "Find a remote graphic designer in Seoul",
  "categories": [{ "slug": "graphic-design", "name": "Graphic design" }],
  "cities": [{ "key": "seoul", "nameEn": "Seoul", "nameKo": "서울" }],
  "instruction": "Instructions to return only supported structured filters"
}
```

The adapter must return one JSON object with only these optional keys:

```json
{
  "categorySlug": "graphic-design",
  "city": "seoul",
  "remoteAvailable": true,
  "query": "brand identity",
  "budgetMax": 1000000
}
```

Omit unneeded keys; do not return null placeholders. The backend validates category/city values, booleans, a query of at most 200 characters, and an integer KRW budget between 0 and 1,000,000,000. Unknown keys and malformed values are rejected. Requests time out after 15 seconds and do not follow redirects.

The backend sends the visitor's request and public taxonomy, never private inquiries, email addresses, account hashes, sessions, or saved lists. It queries its own database using validated filters and applies public profile/owner visibility. The adapter cannot supply arbitrary result IDs, access private records, or perform mutations. Custom-quote prices remain unknown rather than being treated as zero.

If no adapter is configured, a simple Korean/English category/city/remote keyword parser is used. Responses report `mode: KEYWORD`; a configured adapter reports `mode: AI`. Neither mode persists the visitor's chat. Keyword fallback is intentionally limited and is not semantic search. A real provider and Korean/English relevance evaluation remain deployment work.

## Operational boundaries

The included rate limiter is per process: 10 sensitive resolver calls and 120 general resolver calls per IP per minute. A multi-instance deployment needs shared ingress or distributed rate limiting and a deliberate trusted-proxy configuration. The default server does not trust forwarded IP headers.

Lists use bounded offset pagination and initial indexes from the ER guide. Query-plan benchmarking, large-scale search, retention/anonymization, backup erasure, and privileged support access are outside the implemented version. Soft deletion retains historical records and is not permanent account erasure.


## Social sign-in

The backend validates provider-signed RS256 ID tokens and checks subject, issuer, configured audience, expiry, issued-at time, and its single-use nonce. Configure only the providers you enable. Use one application namespace per provider.

- Google: GOOGLE_CLIENT_ID. [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
- Telegram: TELEGRAM_CLIENT_ID for the configured bot/application; configure its allowed URLs. [Telegram login](https://core.telegram.org/bots/telegram-login).
- Kakao: KAKAO_CLIENT_ID (app REST API key), with OpenID Connect enabled. [Kakao Login](https://developers.kakao.com/docs/en/kakaologin/rest-api).

The frontend handles the provider consent/redirect and binds authorization state to the initiating browser. Obtain the backend nonce first and include it in the provider request. Code exchange, secrets, PKCE, and redirect validation must follow the chosen provider frontend/server flow; arbitrary unverified provider IDs are never accepted by loginSocial. The starter does not provision apps or implement frontend callbacks. The in-memory nonce map requires one process or a shared transaction-store replacement before scaling. No live provider integration was tested; signed local fixtures exercise backend verification.
