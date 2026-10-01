# Cachet — Notes, sealed.

A note-sharing app with **secure, expiring share links**: one-time or time-based, public or key-protected, revocable at any moment, with accurate view counts that stay correct under concurrency.

| | |
| --- | --- |
| **Live demo** | https://note-taking-app-tau-smoky.vercel.app |
| **Test account** | `demo@cachet.app` / *(sent with the submission)* |
| **Stack** | Next.js 16 · TypeScript · Hono · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · shadcn/ui |

---

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Setup](#setup)
4. [Database schema](#database-schema)
5. [Share link flow](#share-link-flow)
6. [Password / key generation](#password--key-generation)
7. [Expiry logic](#expiry-logic)
8. [Invalidate / revoke logic](#invalidate--revoke-logic)
9. [View count logic](#view-count-logic)
10. [Race-condition handling](#race-condition-handling)
11. [Edge cases](#edge-cases)
12. [Security decisions](#security-decisions)
13. [Questions from the brief](#questions-from-the-brief)
14. [API reference](#api-reference)
15. [Testing](#testing)
16. [Performance](#performance)
17. [Deployment](#deployment)
18. [Project structure](#project-structure)

---

## Features

**Required**

- Register / login, create notes with title, content, expiry, share type and access type
- **Share type:** one-time (dies after the first successful view) or time-based (works until expiry)
- **Access type:** public or password-protected with a server-generated access key
- Secure share link generated on creation; force-revoke any link; accurate view counts
- Pages: `/login`, `/register`, `/notes/new`, `/notes/[id]`, `/share/[token]`

**Extras**

- **Links:** several independent links per note, "revoke all", extend expiry, issue a new key (old key dies instantly, lockout cleared), QR code, per-link activity log, live-updating counters, a "Share links" page across all notes
- **Security advisor:** flags passwords, API keys, card numbers (Luhn), Aadhaar/PAN etc. in a note and recommends a safer link — runs locally in the browser
- **AI (Google Gemini, optional):** improve, fix grammar, shorten, expand, summarize, bullet points, action items, explain, translate, change tone, suggest title, auto-tags, "Write with AI" from a prompt, *smart share* (judges sensitivity and pre-fills safe link settings), and an in-app assistant that knows the note you are looking at and how Cachet works — streamed, rate-limited, can be switched off
- **Notes:** Markdown editor with toolbar, split preview, templates, tags, colors, pin, archive, trash (restore within 30 days), version history with restore, duplicate, import `.md`/`.txt`, export Markdown, print / save as PDF
- **Account security:** two-factor authentication (TOTP authenticator app + one-time backup codes), device list with remote sign-out, security log, password change signs out other devices
- **Workspace:** dashboard (stats, 14-day views chart, expiring links, onboarding checklist), notifications (link opened, link locked, security events), command palette (`Ctrl K`), keyboard shortcuts, profile with photo upload
- **Settings:** appearance (theme, accent color, text size, reduced motion), editor, sharing defaults, notifications, AI preferences, JSON data export, account deletion
- **Public pages:** landing page, help center with FAQ, Terms, Privacy and Security pages

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript | Required stack; server layouts guard private pages |
| UI | Tailwind CSS 4, shadcn/ui (Radix), CSS animations | Accessible primitives, consistent design tokens, no animation library in the bundle |
| API | Hono, mounted at `/api/*` via a Next.js catch-all route | Small, typed router; `hc<AppType>` gives an end-to-end typed client |
| Validation | zod on the server, lightweight mirrored checks in the browser | The server is the source of truth; zod stays out of the browser bundle |
| Database | PostgreSQL + Drizzle ORM (postgres.js driver) | Row-level locking and atomic conditional updates are what make one-time links safe |
| Auth | Custom server-side sessions (opaque token cookie, hashed in DB) | Revocable, no JWT invalidation problem, easy to reason about |
| Hashing | Node `crypto.scrypt` (memory-hard), SHA-256, HMAC | No native dependencies, OWASP-listed KDF |
| AI | Google Gemini via `@google/genai` (structured JSON output for tags / smart share) | Optional — the app works fully without an API key |
| Tests | Vitest (unit) + `scripts/race-test.ts` (concurrency, against a real server) | |

---

## Setup

**Requirements:** Node.js ≥ 20.9 and a PostgreSQL database (local, Docker, or a free [Neon](https://neon.tech) project).

```bash
git clone <repo-url> cachet && cd cachet
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string |
| `APP_SECRET` | ✅ | ≥ 32 random chars — `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `APP_URL` | recommended | Public origin, used to build share links (e.g. `http://localhost:3000`) |
| `GEMINI_API_KEY` | optional | Enables the AI features ([get a key](https://aistudio.google.com/apikey)) |
| `GEMINI_MODEL` | optional | Defaults to `gemini-3.8-flash` |
| `CRON_SECRET` | optional | ≥ 16 chars; protects the daily cleanup job (`/api/cron/cleanup`, called by Vercel Cron) |
| `DEMO_EMAIL`, `DEMO_PASSWORD` | optional | Used by `npm run db:seed` |

> **Tip (Windows):** a variable set in the system environment overrides `.env.local`. If the AI says the key was rejected although `.env.local` is correct, remove the old system variable (PowerShell: `[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $null, "User")`) and restart the terminal.

**No Postgres installed?** Pick one:

```bash
npm run db:local        # embedded PostgreSQL on port 5433 — no Docker needed (keep this terminal open)
# or
docker run -d --name cachet-pg -e POSTGRES_USER=cachet -e POSTGRES_PASSWORD=cachet -e POSTGRES_DB=cachet -p 5433:5432 postgres:17
```

Both match `DATABASE_URL=postgres://cachet:cachet@localhost:5433/cachet`.

Then:

```bash
npm run db:migrate      # create tables
npm run db:seed         # optional: demo account + 3 sample notes (prints their share links once)
npm run dev             # http://localhost:3000
```

Other scripts: `npm test` (unit tests), `npm run test:race` (concurrency test against a running server), `npm run typecheck`, `npm run lint`, `npm run build`.

---

## Database schema

```mermaid
erDiagram
  users ||--o{ sessions : has
  users ||--o{ notes : owns
  notes ||--o{ share_links : "shared via"
  share_links ||--o{ share_views : "logs"

  users { uuid id PK
          varchar email UK
          varchar name
          text password_hash "scrypt"
          jsonb preferences }
  sessions { varchar id PK "sha256(cookie token)"
             uuid user_id FK
             timestamptz expires_at }
  notes { uuid id PK
          uuid owner_id FK
          varchar title "≤200"
          text content "≤50 000 (CHECK)" }
  share_links { uuid id PK
                uuid note_id FK
                varchar token_hash UK "sha256(token)"
                varchar token_prefix "display only"
                enum share_type "one_time | time_based"
                enum access_type "public | password"
                text key_hash "scrypt, password links only"
                timestamptz expires_at
                timestamptz consumed_at "one-time: first view"
                timestamptz revoked_at
                int view_count
                int failed_attempts
                timestamptz locked_until }
  share_views { bigserial id PK
                uuid link_id FK
                timestamptz viewed_at
                enum method
                varchar ip_hash "HMAC, never raw IP" }
```

Plus `rate_limits(key PK, count, reset_at)` — a fixed-window counter table shared by all server instances — and, from `drizzle/0001_features.sql` / `0002_avatar.sql`: `notifications`, `note_versions`, `security_events`, `feedback`, note columns `pinned / color / tags / archived_at / deleted_at`, and user columns for bio, 2FA (`totp_secret` AES-256-GCM encrypted, hashed `backup_codes`) and the profile photo (`avatar_image` bytea ≤ 100 KB, type checked by magic bytes).

**Integrity enforced by the database itself** (`drizzle/0000_init.sql`):

- `UNIQUE(token_hash)` — a token maps to exactly one link
- `CHECK (share_type <> 'one_time' OR view_count <= 1)` — even a buggy code path cannot record a second view of a one-time link
- `CHECK ((access_type = 'password') = (key_hash IS NOT NULL))` — a password link always has a key; a public link never does
- `CHECK (view_count >= 0)`, `CHECK (char_length(content) <= 50000)`
- `ON DELETE CASCADE` from users → notes → links → views: deleting a note kills every link to it

**Why links live in their own table:** the brief puts expiry/share type/access type on note creation; Cachet creates the first link from those fields in the same transaction, and lets the owner add more links later — each with independent rules, counts and revocation.

---

## Share link flow

```mermaid
sequenceDiagram
  participant O as Owner
  participant A as API (Hono)
  participant DB as Postgres
  participant V as Viewer

  O->>A: POST /api/notes {title, content, share}
  A->>A: token = 32 random bytes; key = XXXX-XXXX-XXXX (if password)
  A->>DB: INSERT note + link {sha256(token), scrypt(key)} (one transaction)
  A-->>O: shareUrl + key — shown once, never stored in plain text

  V->>A: GET /api/share/:token  (landing info, no content, no view counted)
  A->>DB: SELECT … WHERE token_hash = sha256(token)
  A-->>V: {shareType, accessType, expiresAt} or 404/410/423

  V->>A: POST /api/share/:token/access {key?}
  A->>DB: pre-checks (revoked / used / expired / locked)
  A->>DB: reserve a guess slot (password links only)
  A->>A: scrypt verify (constant time)
  A->>DB: BEGIN; UPDATE … SET view_count+1, consumed_at … WHERE still valid RETURNING; INSERT share_views; COMMIT
  A-->>V: note content  (or 401 wrong key / 410 lost the race)
```

1. **Creation** — `createShareLink()` in `src/server/services/share.ts` generates a 256-bit token (`crypto.randomBytes(32)`, base64url → 43 chars). Only `sha256(token)` is stored, plus a 6-char prefix so the owner can tell links apart. The full URL is shown to the owner **once**.
2. **Landing** — `/share/[token]` renders a shell; the browser calls `GET /api/share/:token`, which never returns content or counts a view. This is why Slack/WhatsApp/email link-preview bots **cannot burn a one-time link**.
3. **Opening** — `POST /api/share/:token/access` is the only path that returns note content.
   - Public + time-based: the page opens it automatically.
   - Public + one-time: the viewer must click *"Break the seal & read"* (explicit intent, see point 2).
   - Password: the viewer enters the key.

---

## Password / key generation

`generateAccessKey()` in `src/server/lib/crypto.ts`:

- 12 characters from a 31-character alphabet with no look-alikes (`0 O 1 I L` removed), grouped as `K7QM-3XHP-RW9D`
- Each character is drawn with `crypto.randomInt()` — CSPRNG, uniform, **no modulo bias**
- Entropy: 12 × log₂(31) ≈ **59 bits** (≈ 7.9 × 10¹⁷ combinations)
- Input is normalized (`k7qm 3xhp-rw9d` works) before hashing/verification
- Stored as `scrypt$N$r$p$salt$hash` (N = 2¹⁵, r = 8, p = 1, 16-byte random salt, ≈ 32 MiB per hash). Verification uses `crypto.timingSafeEqual`
- A new key can be issued for an active link (`POST …/regenerate-key`): the old hash is replaced atomically, the lockout is cleared, the new key is shown once

The key is generated by the server — users cannot pick weak keys.

---

## Expiry logic

- Every link has an absolute `expires_at` (`timestamptz`). The client sends ISO-8601 UTC; the server validates it is **≥ 2 minutes** and **≤ 365 days** in the future
- **Time-based** links work until `expires_at`
- **One-time** links also carry `expires_at` — a link that is never opened must still die
- Expiry is always evaluated **in SQL with the database clock** (`expires_at > now()`), inside the same statement that records the view — no app-server clock skew, no window between "check" and "use"
- The UI re-computes status every second, so a link flips to *Expired* on screen without reloading; the server decides regardless
- Status precedence: `revoked` → `used` → `expired` → `locked` → `active` (`linkStatus()`)

---

## Invalidate / revoke logic

- `POST /api/notes/:id/links/:linkId/revoke` sets `revoked_at = coalesce(revoked_at, now())` — idempotent, keeps the original time
- `POST /api/notes/:id/links/revoke-all` revokes every link of a note
- Deleting a note cascades to its links → every URL becomes *invalid*
- The access claim includes `revoked_at IS NULL` in its `WHERE`, so a revoke that commits a millisecond before a view wins: the viewer receives `410 link_revoked`
- Ownership is checked on every call; another user's note/link returns **404, not 403**, so IDs cannot be probed

---

## View count logic

| Situation | Counted? |
| --- | --- |
| Public link opened | ✅ +1 |
| Correct key | ✅ +1 |
| Wrong key / missing key | ❌ (only `failed_attempts` changes) |
| Expired, revoked, used or locked link | ❌ |
| Landing request (`GET /api/share/:token`) | ❌ |
| Owner viewing their own note in the app | ❌ |

The increment is `view_count = view_count + 1` **inside the same conditional UPDATE that validates the link**, plus an `INSERT INTO share_views` in the same transaction. There is no read-modify-write in application code, so concurrent views can never overwrite each other, and the audit log always matches the counter.

---

## Race-condition handling

**One-time links under concurrency** — the claim is a single statement:

```sql
UPDATE share_links
SET view_count     = view_count + 1,
    last_viewed_at = now(),
    consumed_at    = CASE WHEN share_type = 'one_time' THEN now() ELSE NULL END,
    failed_attempts = 0
WHERE id = $1
  AND revoked_at IS NULL
  AND consumed_at IS NULL
  AND expires_at > now()
  AND (locked_until IS NULL OR locked_until <= now())
  AND key_hash IS NOT DISTINCT FROM $verified_key_hash
RETURNING …;
```

When N requests arrive together, Postgres takes a row lock for the first `UPDATE`; the others wait. After the first transaction commits, each waiting `UPDATE` **re-evaluates its `WHERE` clause against the new row version** (READ COMMITTED semantics), sees `consumed_at IS NOT NULL`, and updates **0 rows**. Exactly one request receives the content; the rest get `410 link_used`. The `CHECK (view_count <= 1)` constraint is a second, independent guarantee.

**Brute force under concurrency** — a naive "check counter, verify, then increment" lets 100 parallel guesses all pass the check. Cachet **reserves** a guess slot first:

```sql
UPDATE share_links SET failed_attempts = failed_attempts + 1
WHERE id = $1 AND failed_attempts < 5 AND (locked_until IS NULL OR locked_until <= now())
RETURNING id;
```

Only 5 requests can win a slot per lock window; everything else is locked out **before** any key is checked. A wrong key keeps the slot used; when all 5 are used the link locks for 15 minutes (`locked_until`), computed in the same statement. A correct key resets the counter.

**Other races handled**

- Key regenerated between verification and claim → the claim requires `key_hash` to still equal the hash that was verified
- Two registrations with the same email → `INSERT … ON CONFLICT DO NOTHING` → clean `409`, not a 500
- Rate-limit counters → one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`

**Proven by a test** — `npm run test:race` fires 25 simultaneous requests per scenario at a running server:

```
✔ one-time public link — 1 success(es), statuses {"200":1,"410":24}
✔ one-time view count — view_count = 1
✔ one-time password link — 1 success(es), statuses {"200":1,"410":4}
✔ time-based view count — 25 successful views, view_count = 25
✔ parallel brute force capped — statuses {"423":25} (at most 5 guesses are ever checked per lock window)
✔ revoked link — status 410
```

---

## Edge cases

| Edge case | Behaviour | Where |
| --- | --- | --- |
| Invalid / malformed link | `404 link_invalid`; malformed tokens are rejected by regex before touching the DB | `findByToken()` |
| Public link | Opens without a key (time-based auto-opens; one-time needs a click) | `share-viewer.tsx` |
| Password link | Key form; `401 key_required` without a key | `accessSharedNote()` |
| Wrong key | `401 key_invalid` + attempts remaining; no view counted | `recordFailedAttempt()` |
| Too many wrong keys | `423 link_locked` + `Retry-After`; countdown in the UI | `reserveAttempt()` |
| Expired link | `410 link_expired` | SQL `expires_at > now()` |
| One-time link already used | `410 link_used` | SQL `consumed_at IS NULL` |
| Revoked link | `410 link_revoked` | SQL `revoked_at IS NULL` |
| Many users open a one-time link at once | Exactly one succeeds | conditional `UPDATE` + CHECK |
| Accurate view count | Atomic increment + audit row in one transaction | `accessSharedNote()` |
| Link-preview bots | Landing endpoint never counts or reveals content | `GET /api/share/:token` |
| Owner deletes note | All links become invalid (cascade) | FK `ON DELETE CASCADE` |
| Key regenerated mid-unlock | Old key's claim fails | `key_hash` in claim `WHERE` |
| Expiry in the past / > 1 year | `422 validation_failed` | `shareSettingsSchema` |
| Someone else's note ID | `404` (no existence leak) | `getOwnedNote()` |

---

## Security decisions

| Threat | Mitigation |
| --- | --- |
| Guessing share links | 256-bit random tokens; unguessable, not enumerable |
| Database leak | Tokens and session IDs stored as SHA-256, keys/passwords as salted scrypt, IPs as HMAC — nothing in the DB can be replayed |
| Brute-forcing keys | 59-bit keys + per-link reserve-then-verify lockout (5 / 15 min) + per-IP limits (20 unlocks / 10 min, 60 share requests / min) |
| Credential stuffing | Per-IP (20 / 15 min) and per-email (8 / 15 min) login limits; scrypt; generic "incorrect email or password"; dummy-hash check so timing doesn't reveal which emails exist |
| Session theft / fixation | Opaque random token, `HttpOnly`, `SameSite=Lax`, `Secure`, `__Host-` prefix in production; server-side sessions can be revoked; password change signs out other devices |
| CSRF | `SameSite=Lax` cookies **and** an `Origin` check on every state-changing request |
| XSS | Strict nonce-based CSP (`script-src 'nonce-…' 'strict-dynamic'`), React escaping, Markdown rendered without raw HTML, `javascript:` URLs stripped |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| Token leaking via Referer | `Referrer-Policy: no-referrer` on `/share/*`; outbound links use `rel="noopener noreferrer"` |
| Caching of secrets | `Cache-Control: no-store` on every API response and share page; the content endpoint is `POST` |
| Search engines / previews | `X-Robots-Tag: noindex`, generic OpenGraph tags (title/content never in previews), robots.txt |
| Tracking pixels in notes | Remote images in Markdown are not rendered |
| IDOR | Ownership enforced in every query; 404 instead of 403 |
| Open redirect after login | `?next=` accepts same-site paths only |
| Oversized payloads | 128 KB body limit, zod length limits, DB CHECK |
| Error leakage | Unknown errors are logged server-side; clients get a generic message |
| AI cost abuse / prompt injection | Auth required, 60 AI calls / hour / user, 20 k char input cap; note text is wrapped and treated as data; output only shown to its owner |

---

## Questions from the brief

**How do you prevent two users from using a one-time link at the same time?**
The view is claimed with one conditional `UPDATE … WHERE consumed_at IS NULL … RETURNING`. Postgres row locking serializes concurrent claims; after the first commits, the others re-check the `WHERE` clause against the updated row and match zero rows, so they receive `410 link_used`. A `CHECK (view_count <= 1)` constraint on one-time links is a second safety net. `npm run test:race` demonstrates 1 winner out of 25 simultaneous requests.

**How do you update view count safely?**
Never read-then-write in application code. The database does `view_count = view_count + 1` atomically in the same statement that validates the link (not expired, not revoked, not consumed, correct key), and inserts the audit row in the same transaction. Failed, expired and revoked attempts can't reach that statement, so they never count.

**How would this work if 1 million people opened the link?**
- The API is stateless and runs on serverless functions that scale horizontally; static assets come from the CDN. The database hot path is an indexed lookup on a unique hash plus one single-row update, through Neon's connection pooler.
- **One-time link:** only the first request writes. Every later request fails at the read-only pre-check (`consumed_at` is already set) without taking a lock, so it is cheap.
- **Time-based link:** the bottleneck is the single hot row being incremented. At that scale I would (1) shard the counter into N rows and sum on read, or (2) buffer increments in Redis (`INCR`) and flush to Postgres periodically, keeping the append-only `share_views` table as the source of truth, and (3) move rate limiting from Postgres to Redis/edge. Note content must stay `no-store` (never CDN-cached) because one-time and revoke semantics depend on every request reaching the server; the landing metadata could get a very short cache if needed.

**How would you prevent brute-force attempts on password-protected links?**
Layered: the key has ≈59 bits of entropy and is server-generated; keys are scrypt-hashed so a DB leak doesn't help offline; per link, a guess slot is *reserved atomically before* the key is checked, so no more than 5 guesses are ever evaluated per 15-minute window — even with thousands of parallel requests from many IPs; per IP, unlock attempts and share requests are rate-limited with `429 + Retry-After`; wrong keys never count as views. The owner can issue a new key at any time, which also clears the lock.

---

## API reference

All endpoints are under `/api`, JSON in/out, errors as `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | – | Create account + session |
| POST | `/auth/login` | – | Sign in |
| POST | `/auth/logout` | – | End session |
| POST | `/auth/login/2fa` | – | Second step when two-factor authentication is on |
| GET | `/auth/me` | ✅ | Current user |
| GET | `/notes?q=&view=&tag=&sort=` | ✅ | List/search notes (all, pinned, shared, archived, trash) with link stats |
| GET | `/notes/tags` | ✅ | Tags with counts |
| POST | `/notes` | ✅ | Create note (+ optional first share link, URL + key returned once) |
| GET/PATCH/DELETE | `/notes/:id` | ✅ | Read / edit / move to trash |
| POST | `/notes/:id/restore`, `/notes/:id/duplicate` | ✅ | Restore from trash / duplicate |
| DELETE / POST | `/notes/:id/permanent`, `/notes/trash/empty` | ✅ | Delete forever |
| GET / POST | `/notes/:id/versions`, `/notes/:id/versions/:versionId/restore` | ✅ | Version history |
| POST | `/notes/:id/links` | ✅ | Additional share link |
| POST | `/notes/:id/links/:linkId/revoke` | ✅ | Revoke one link |
| POST | `/notes/:id/links/revoke-all` | ✅ | Revoke all links of a note |
| POST | `/notes/:id/links/:linkId/regenerate-key` | ✅ | New access key |
| POST | `/notes/:id/links/:linkId/extend` | ✅ | Change expiry |
| GET | `/notes/:id/links/:linkId/views` | ✅ | Activity log |
| GET | `/share/:token` | – | Landing metadata (no content, no count) |
| POST | `/share/:token/access` | – | Open / unlock — the only content endpoint |
| GET/PATCH | `/account`, `/account/preferences` | ✅ | Profile & settings |
| GET/PUT/DELETE | `/account/avatar` | ✅ | Profile photo (JPEG/PNG/WebP ≤ 100 KB) |
| POST | `/account/password` | ✅ | Change password |
| POST | `/account/2fa/setup`, `enable`, `disable`, `backup-codes` | ✅ | Two-factor authentication |
| GET | `/account/security-log` | ✅ | Security events |
| GET/DELETE/POST | `/account/sessions`, `/account/sessions/:handle`, `/account/sessions/revoke-others` | ✅ | Devices |
| GET | `/account/export` | ✅ | JSON export |
| POST | `/account/feedback` | ✅ | Send feedback |
| DELETE | `/account` | ✅ | Delete account (password required) |
| GET | `/dashboard`, `/links` | ✅ | Dashboard stats, all share links |
| GET/POST/DELETE | `/notifications`, `/notifications/read-all`, `/notifications/:id/read` | ✅ | Notifications |
| GET/POST | `/ai/status`, `/ai/assist`, `/ai/generate`, `/ai/chat` | ✅ | AI availability; streamed rewrite, generation and assistant |
| POST | `/ai/tags`, `/ai/smart-share` | ✅ | Structured AI suggestions (JSON schema) |
| GET | `/cron/cleanup` | Bearer `CRON_SECRET` | Daily cleanup job |

Status codes used: `401` wrong/missing key or not signed in · `404` invalid link · `410` expired/used/revoked · `422` validation · `423` link locked · `429` rate limited.

---

## Testing

```bash
npm test               # unit tests: tokens, keys, scrypt, link status, validation, redirects, security advisor, TOTP (RFC 6238 vectors), editor formatting, preferences
npm run dev            # in one terminal
npm run test:race      # concurrency scenarios against the running server (BASE_URL=… for a deployment)
```

---

## Performance

What keeps pages fast on mid-range phones:

- **Server-rendered data.** App pages prefetch their data on the server by calling the Hono API in-process (`src/server/prefetch.ts` — same handlers, auth and ownership checks) and hand it to React Query, so the HTML already contains the notes and dashboard instead of loading skeletons.
- **No large `<Suspense>` wrappers around page content.** React 19.2 streams large boundaries at the end of the HTML and reveals them later with a script; keeping page content outside them lets the browser paint it straight away.
- **Small startup JavaScript.** zod, the Markdown renderer, the toast library, the command palette, the AI assistant, dialogs, QR codes and version history are code-split and loaded on first use; public pages avoid Radix and React Query entirely; animations are plain CSS.
- **Cheap painting.** No `backdrop-filter`, SVG turbulence filters or fixed full-screen layers; a 5 KB tiled PNG provides the paper grain.
- **Region.** `vercel.json` pins functions to Singapore (`sin1`), next to the Neon database (`ap-southeast-1`), so each query is a ~1 ms round trip.

Lighthouse and automated-test results are in `docs/Cachet-Test-Report.pdf`. After deploying, check the live site at [PageSpeed Insights](https://pagespeed.web.dev).

---

## Deployment

Deployed on **Vercel** (Next.js + Hono in one project) with **Neon** serverless Postgres.

1. Create a Neon project (region *Asia Pacific (Singapore)*) and copy the **pooled** connection string (host contains `-pooler`, keep `?sslmode=require`)
2. Import the GitHub repository in Vercel. If the app sits in a sub-folder of the repository, set **Root Directory** to that folder (`cachet`)
3. Add the environment variables: `DATABASE_URL`, `APP_SECRET`, optionally `GEMINI_API_KEY`, `GEMINI_MODEL` and `CRON_SECRET`. `APP_URL` is optional on Vercel — the production domain is used automatically
4. Deploy — the `vercel-build` script runs `drizzle-kit migrate` before `next build`; `vercel.json` sets the region (`sin1`) and the daily cleanup cron
5. Optionally seed the demo account: `npm run db:seed` with `DATABASE_URL` pointing at Neon

---

## Project structure

```
src/
├─ app/
│  ├─ (marketing)/                   # landing, help, terms, privacy, security
│  ├─ (auth)/login, register        # public auth pages (redirect if signed in)
│  ├─ (app)/dashboard, notes,        # private pages (server layout checks the session
│  │        notes/new, notes/[id],   #  and the pages prefetch their data on the server)
│  │        links, notifications, trash, profile, settings
│  ├─ share/[token]/                 # public viewer
│  └─ api/[[...route]]/route.ts      # hands every /api request to Hono
├─ server/                           # never shipped to the browser ("server-only")
│  ├─ app.ts                         # Hono app: security middleware, error handler, routes
│  ├─ routes/                        # auth, notes, share, account, ai, workspace, cron
│  ├─ prefetch.ts                    # in-process API calls for server-rendered page data
│  ├─ services/share.ts              # link creation, access, lockout, race-safe claim
│  ├─ auth/                          # sessions
│  ├─ lib/                           # crypto, scrypt, rate limiting, request helpers
│  └─ db/                            # Drizzle schema + client
├─ components/                       # UI (shadcn/ui primitives in components/ui)
├─ lib/                              # shared: constants, zod schemas (server), client checks, typed API client, formatting
└─ proxy.ts                          # per-request CSP nonce
drizzle/                             # SQL migrations
scripts/                             # seed, race test, local embedded Postgres
docs/                                # test report (Lighthouse + automated tests)
tests/                               # unit tests
```
