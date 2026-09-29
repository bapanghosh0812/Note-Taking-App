# Cachet — Notes, sealed.

A note-sharing app with **secure, expiring share links**: one-time or time-based, public or key-protected, revocable at any moment, with accurate view counts that stay correct under concurrency.

| | |
| --- | --- |
| **Live demo** | `https://<your-deployment>.vercel.app` |
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
16. [Deployment](#deployment)
17. [Project structure](#project-structure)

---

## Features

**Required**

- Register / login, create notes with title, content, expiry, share type and access type
- **Share type:** one-time (dies after the first successful view) or time-based (works until expiry)
- **Access type:** public or password-protected with a server-generated access key
- Secure share link generated on creation; force-revoke any link; accurate view counts
- Pages: `/login`, `/register`, `/notes/new`, `/notes/[id]`, `/share/[token]`

**Extras**

- Several independent links per note (e.g. one public, one key-protected) and "revoke all"
- Issue a new key for a link (old key dies instantly, lockout cleared)
- Per-link activity log (time, public/unlocked, device) and live-updating counters
- Security advisor: flags passwords, API keys, card numbers (Luhn), Aadhaar/PAN etc. in a note and recommends a safer link — runs locally in the browser
- AI writing assistant (Claude): improve, fix grammar, shorten, expand, summarize, bullet points, suggest title — streamed, rate-limited, optional
- Markdown notes with safe rendering, QR code for links, command palette (`Ctrl K`), light/dark themes
- Settings: profile, default link settings, AI toggle, change password, signed-in devices, JSON export, delete account

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript | Required stack; server layouts guard private pages |
| UI | Tailwind CSS 4, shadcn/ui (Radix), motion | Accessible primitives, consistent design tokens |
| API | Hono, mounted at `/api/*` via a Next.js catch-all route | Small, typed router; `hc<AppType>` gives an end-to-end typed client |
| Validation | zod (shared by browser and server) | One schema, two uses — the server is still the source of truth |
| Database | PostgreSQL + Drizzle ORM (postgres.js driver) | Row-level locking and atomic conditional updates are what make one-time links safe |
| Auth | Custom server-side sessions (opaque token cookie, hashed in DB) | Revocable, no JWT invalidation problem, easy to reason about |
| Hashing | Node `crypto.scrypt` (memory-hard), SHA-256, HMAC | No native dependencies, OWASP-listed KDF |
| AI | Anthropic Claude via `@anthropic-ai/sdk` | Optional — the app works fully without an API key |
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
| `ANTHROPIC_API_KEY` | optional | Enables the AI assistant |
| `AI_MODEL` | optional | Defaults to `claude-opus-5-5` |
| `DEMO_EMAIL`, `DEMO_PASSWORD` | optional | Used by `npm run db:seed` |

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

Plus `rate_limits(key PK, count, reset_at)` — a fixed-window counter table shared by all server instances.

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
| AI cost abuse / prompt injection | Auth required, 30 AI calls / hour / user, 20 k char input cap; note text is wrapped and treated as data; output only shown to its owner |

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
| GET | `/auth/me` | ✅ | Current user |
| GET | `/notes?q=` | ✅ | List/search notes with link stats |
| POST | `/notes` | ✅ | Create note + first share link (returns URL + key once) |
| GET/PATCH/DELETE | `/notes/:id` | ✅ | Read / edit / delete a note |
| POST | `/notes/:id/links` | ✅ | Additional share link |
| POST | `/notes/:id/links/:linkId/revoke` | ✅ | Revoke one link |
| POST | `/notes/:id/links/revoke-all` | ✅ | Revoke all links of a note |
| POST | `/notes/:id/links/:linkId/regenerate-key` | ✅ | New access key |
| GET | `/notes/:id/links/:linkId/views` | ✅ | Activity log |
| GET | `/share/:token` | – | Landing metadata (no content, no count) |
| POST | `/share/:token/access` | – | Open / unlock — the only content endpoint |
| PATCH | `/account` | ✅ | Name & preferences |
| POST | `/account/password` | ✅ | Change password |
| GET/DELETE | `/account/sessions[/:handle]` | ✅ | Devices |
| GET | `/account/export` | ✅ | JSON export |
| DELETE | `/account` | ✅ | Delete account (password required) |
| GET/POST | `/ai/status`, `/ai/assist` | ✅ | AI availability / streamed rewrite |

Status codes used: `401` wrong/missing key or not signed in · `404` invalid link · `410` expired/used/revoked · `422` validation · `423` link locked · `429` rate limited.

---

## Testing

```bash
npm test               # 29 unit tests: tokens, keys, scrypt, link status, validation, redirects, security advisor
npm run dev            # in one terminal
npm run test:race      # concurrency scenarios against the running server (BASE_URL=… for a deployment)
```

---

## Deployment

Deployed on **Vercel** (Next.js + Hono in one project) with **Neon** serverless Postgres.

1. Create a Neon project and copy the **pooled** connection string (host contains `-pooler`, keep `?sslmode=require`)
2. Import the GitHub repository in Vercel and add the environment variables (`DATABASE_URL`, `APP_SECRET`, `APP_URL`, optionally `ANTHROPIC_API_KEY`)
3. Deploy — the `vercel-build` script runs `drizzle-kit migrate` before `next build`
4. Optionally seed the demo account: `DATABASE_URL=<neon-url> APP_URL=<vercel-url> npm run db:seed`

---

## Project structure

```
src/
├─ app/
│  ├─ (auth)/login, register        # public auth pages (redirect if signed in)
│  ├─ (app)/notes, notes/new,        # private pages (server layout checks the session)
│  │        notes/[id], settings
│  ├─ share/[token]/                 # public viewer
│  └─ api/[[...route]]/route.ts      # hands every /api request to Hono
├─ server/                           # never shipped to the browser ("server-only")
│  ├─ app.ts                         # Hono app: security middleware, error handler, routes
│  ├─ routes/                        # auth, notes, share, account, ai
│  ├─ services/share.ts              # link creation, access, lockout, race-safe claim
│  ├─ auth/                          # sessions
│  ├─ lib/                           # crypto, scrypt, rate limiting, request helpers
│  └─ db/                            # Drizzle schema + client
├─ components/                       # UI (shadcn/ui primitives in components/ui)
├─ lib/                              # shared: zod schemas, typed API client, formatting
└─ proxy.ts                          # per-request CSP nonce
drizzle/                             # SQL migrations
scripts/                             # seed, race test, local embedded Postgres
tests/                               # unit tests
```
