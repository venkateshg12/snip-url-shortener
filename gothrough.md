# Project walkthrough: snip, a URL shortener

A guide to the whole project for interview preparation: what exists, how each flow works step by
step, which file does what, and the questions you're likely to be asked.

Contents:
[1. The pitch](#1-the-60-second-pitch) ·
[2. Architecture](#2-architecture) ·
[3. The repository](#3-the-repository) ·
[4. Flows, step by step](#4-flows-step-by-step) ·
[5. The database](#5-the-database) ·
[6. Every file](#6-every-file-explained) ·
[7. Testing](#7-how-it-is-tested) ·
[8. Interview questions](#8-interview-questions-and-answers) ·
[9. Limits](#9-honest-limits-what-is-not-built)

---

## 1. The 60-second pitch

> "I built a full-stack URL shortener: an Express API on PostgreSQL through Prisma, Redis, and a
> Next.js frontend, in a pnpm and Turborepo monorepo. Short codes are 7 Base62 characters generated
> from a database sequence through a bijective permutation, so they look random but **can't
> collide**. Redirects are served from a Redis cache with negative caching, request coalescing
> and a circuit breaker, so they keep working when Redis is down. Every click is recorded **without
> the redirect waiting**: clicks are buffered in memory, sent to a BullMQ queue in batches, and a
> separate worker writes them with an idempotent SQL statement, so a retried job never
> double-counts. Users get JWT cookie auth with refresh-token rotation, a dashboard, per-link
> analytics in their own time zone, and QR codes. It has 135 automated tests running against real
> Postgres and Redis."

---

## 2. Architecture

```
                 ┌──────────────────────── Next.js web app (:3000) ─────────────────────────┐
  Browser ──────▶│ pages · TanStack Query hooks · axios (cookies) · Zustand · design system │
     │           └──────────────────────────────────┬───────────────────────────────────────┘
     │                                              │ XHR /api/* (credentials: cookies)
     │  GET /:code (a short link)                   ▼
     └──────────────────────────────────▶ Express API (:4000) ─────────▶ Prometheus /metrics (:9100)
                                           │         │        │
                     cache-aside, 1 GET    │         │        │ rate limits + click batches
                                           ▼         ▼        ▼
                                 Redis "cache"   PostgreSQL   Redis "queue" ◀──── Worker process
                                 allkeys-lru     (Prisma)     noeviction          (BullMQ consumer)
                                 port 6380       port 5433    port 6379             │
                                                    ▲                               │
                                                    └──── batched INSERT … ON CONFLICT
```

**Why two Redis instances:** the cache *must* evict (so it stays bounded: `allkeys-lru`), and the
queue *must never* evict (losing a job loses clicks: `noeviction`). The eviction policy is set per
instance, so they can't share one.

**Why a separate worker process:** parsing user agents and writing to Postgres is work the
redirect should never wait for, and the worker can be scaled on its own.

---

## 3. The repository

```
url-shortener/
├── apps/
│   ├── api/          Express API + the BullMQ worker (same code, two entry points)
│   └── web/          Next.js 16 App Router frontend
├── packages/
│   ├── types/        Zod schemas + TypeScript types shared by api and web (the API contract)
│   ├── ui/           Design system: colour tokens (light/dark) + UI primitives on Radix
│   ├── eslint-config/     Shared lint rules
│   └── typescript-config/ Shared tsconfig presets
├── infra/postgres/init/   SQL that creates the test database on first start
├── docker-compose.yml     Postgres 18 + two Redis 7 instances
├── architect/             The build plan, one doc per phase
├── tracking.md            Which phases are done, with evidence
└── turbo.json             Task pipeline: build, dev, lint, typecheck, test
```

**How the monorepo works:** one `pnpm install` for everything. Apps import packages as
`"@repo/types": "workspace:*"`. `@repo/types` and `@repo/ui` are **source-only** (no build
step): Next compiles them via `transpilePackages`, and the API's esbuild bundles `@repo/types` in.
`turbo.json` runs tasks in dependency order and runs `prisma generate` before type-checking,
testing or building the API.

**The rule:** apps import from packages, never from each other. The only contract between web
and API is HTTP plus `@repo/types`.

---

## 4. Flows, step by step

### Flow A: creating a short link

**In the browser** (`apps/web`):
1. `components/urls/ShortenForm.tsx` renders the form. React Hook Form validates with
   **the same Zod schema the API uses** (`createUrlSchema` from `packages/types/src/url.ts`), so
   client and server can never disagree.
2. On blur, `withScheme()` turns `example.com/page` into `https://example.com/page`.
3. Submit calls `hooks/urls/useCreateShortUrl.ts` (a TanStack Query mutation), which calls
   `api/urls.ts → createShortUrl()`, which posts through the single axios instance in `lib/api.ts`
   (with `withCredentials: true`, so the session cookie is sent).

**In the API** (`apps/api`), the request passes through:
4. `app.ts`: `requestId` (gives the request an id) → `metricsMiddleware` (times it) → `pino-http`
   (logs it) → the `/api` router: `apiLimiter` (300 per 5 min per IP) → `helmet`, `cors`,
   `express.json({ limit: "10kb" })`, `cookieParser`.
5. `routes/url.route.ts`: `POST /api/urls` → `optionalAuth` → `createLimiter` → `createUrlHandler`.
   - `middleware/authenticate.ts → optionalAuth`: no cookie means anonymous. **An expired cookie is a
     401, not anonymous**, otherwise an expired session would silently create an unowned link.
   - `config/rateLimiter.ts → createLimiter`: 10/hour anonymous (by IP) or 60/hour logged in (by
     user id).
6. `controllers/url.controller.ts`: `createUrlSchema.parse(req.body)` (throws `ZodError` → 400) →
   `createShortUrl(input, { userId })`.
7. `services/url.service.ts → createShortUrl()`:
   - `utils/url/normalize.ts`: canonicalises the URL and **rejects our own domain** (prevents redirect
     loops and chains of short links).
   - `resolveExpiry()`: anonymous links are clamped to at most 30 days; users choose freely.
   - `purgeAt = expiresAt + 30 days` (the row is kept 30 days after expiry; see Flow J).
   - **Custom alias:** needs login (401) and must not be reserved (`constants/reservedCodes.ts`,
     400). Insert; a unique violation (`P2002`) becomes **409 ALIAS_TAKEN**.
   - **Generated code:** `insertWithGeneratedCode()` → `nextId()` → `generateShortCode(id)` →
     insert. On `P2002` (a custom alias already took that code), take the next id and retry, up to 3
     times.
   - **Write-through:** the new link is written into the Redis cache (`urlCache.set`), which
     overwrites any "doesn't exist" entry from someone probing the code earlier.
   - Returns `toUrlDto(url)`: `bigint` → number, the internal `id` hidden, dates as ISO strings.
8. Response: `201 { status: "success", data: UrlDto }` (the envelope, from `utils/api/apiEnvelope.ts`).

**Back in the browser:**
9. The mutation succeeds. A guest's link is saved to `store/recentLinks.store.ts` (Zustand,
   persisted in localStorage); a user's link list query is invalidated so the dashboard refetches.
10. `ShortLinkResult.tsx` appears ("Your link is ready"), with **Copy focused** and a brief highlight.

**On failure:** `lib/api.ts` converts every error into an `ApiError` (`lib/errors.ts`). The form
puts field errors on the matching inputs (`lib/forms.ts → applyFieldErrors`), shows a 409 inline
under the alias field, and shows anything else in a `FormAlert` (`role="alert"`). What you typed
is kept.

### Flow B: the redirect (the hot path)

`GET /:code`, where most traffic goes. The goal: one network call and no writes.

1. `routes/redirect.route.ts`: mounted **last** in `app.ts` (otherwise `/:code` would swallow `/api`
   and `/health`). Middleware: `missLimiter.guard` → `redirectLimiter` → `redirectHandler`. Both
   limiters are **in memory**, so there's no extra network hop.
2. `controllers/redirect.controller.ts`:
   - `isValidShortCode(code)` (regex `^[A-Za-z0-9_-]{3,32}$`). Junk like `/wp-login.php` goes
     straight to `/not-found` with **no Redis or DB work**, and counts as a miss for the scanner
     limiter.
   - `resolveShortCode(code)`, then by result: `found` → record the click (synchronous, in memory)
     → `302` + `Cache-Control: no-store`; `expired` → 302 to `WEB_URL/expired`; `not_found` → 302 to
     `WEB_URL/not-found` (and count a miss).
3. `services/redirect.service.ts → resolveShortCode()`:
   - `urlCache.get(code)` (`utils/cache/urlCache.ts`), key `url:v1:<code>`:
     - **hit** → `{ i: id, u: longUrl, e: expiresAt }`, check expiry, done: **one Redis GET, zero SQL**.
     - **negative hit** (`"__none__"`) → not found, no SQL.
     - **miss, error or breaker open** → `null` (it never throws).
   - On a miss: `singleFlight(code, load)` (`utils/cache/singleFlight.ts`), so **50 concurrent requests
     for the same cold code make ONE Postgres query**; the others await the same promise.
   - The load: `prisma.url.findUnique({ where: { shortCode } })`, which uses the unique index.
     Not found or disabled → cache a negative entry for 60s. Found → cache it for 24h ±10% jitter,
     capped at the time left before expiry (`ttlFor`), **without awaiting the SET**.
4. **Why 302 and not 301:** browsers cache 301s forever, so repeat clicks wouldn't reach us: no
   analytics, and disabling a link wouldn't work.

**When Redis is down:**
- `config/redis.ts`: the cache client is **fail-fast** (`enableOfflineQueue: false`, a 50ms
  `commandTimeout`), so a dead Redis rejects immediately instead of hanging the redirect.
- `utils/cache/circuitBreaker.ts`: after 5 failures within 10s the breaker **opens** for 30s, and
  cache calls are skipped entirely (no 50ms wait per request). Then it's **half-open**: one probe
  request; success closes it.
- Result: redirects fall back to Postgres, with 0 errors (tested: `cache.integration.test.ts`).

### Flow C: how a short code is generated (the favourite interview topic)

Files: `services/idAllocator.service.ts`, `utils/shortCode/permute.ts`, `utils/shortCode/base62.ts`.

**Step 1: a unique number from Postgres, in blocks (the hi/lo pattern).**
- The migration creates `CREATE SEQUENCE url_id_block_seq INCREMENT BY 1000`.
- Each API instance calls `SELECT nextval(...)` once, gets e.g. `5000`, and owns ids `4001–5000`
  in memory. The next 999 links need no database call for their id.
- `nextval` is atomic and never rolls back, so **two instances can never get overlapping blocks**.
  Concurrent callers share one refill (a shared promise), so 5,000 parallel calls use exactly 5
  `nextval`s (tested).
- A restart wastes the rest of a block. That's harmless: there are 3.5 trillion codes.

**Step 2: scramble the number, so codes aren't sequential.**
Sequential ids would give `0000001`, `0000002`: guessable, and they reveal your volume. So:
`permute(id) = affine₂( reverseDigits( affine₁(id) ) )`, where `affine(x) = (x·P + C) mod 62⁷`.
- **Why it can't collide:** `x ↦ (x·P + C) mod M` is a *bijection* (one-to-one) when
  `gcd(P, M) = 1`. `M = 62⁷ = 2⁷ · 31⁷`, so P must be **odd and not a multiple of 31**
  (`constants/env.ts` refuses to boot otherwise). Reversing digits is also a bijection. **A
  composition of bijections is a bijection**, so distinct ids always give distinct codes.
- **Why two rounds:** one affine step leaves visible patterns in some digit positions; reversing
  the digits and applying a second step mixes them.
- `BigInt` everywhere: `id × P` overflows JavaScript's safe integers.

**Step 3: Base62 encode, padded to 7 characters** (`encodeBase62`).

**Step 4: the database is the final authority.** A custom alias could equal a future generated
code, so the unique constraint on `short_code` decides; `P2002` triggers a retry with the next id.

**Honest caveat:** this is *obfuscation*, not cryptography. Someone with many codes could
recover P and C. That's fine for public links; private links would use `crypto.randomBytes`.

Tested: 1,000,000 ids → 1,000,000 distinct codes (`permute.test.ts`).

### Flow D: click analytics (off the hot path)

**1. Record (in the API, during the redirect):** `jobs/producers/clickRecorder.ts → record()`
is **synchronous, with no I/O**. It pushes `{ id: uuidv7(), urlId, ts, ua, referrer, country,
visitor }` into an in-memory array.
- `visitor` = `HMAC(secret, UTC date + IP)` (`utils/analytics/visitor.ts`). **The raw IP is never
  stored.** It can't be reversed, and it changes every day, so it only supports "unique visitors
  per day".
- The buffer is capped at 10,000 (beyond that, clicks are dropped and counted, not held in memory
  without limit).

**2. Flush:** every 1s, or at 500 events, `flush()` sends the whole batch as **one** BullMQ job
(`jobs/queues/click.queue.ts`). One Redis write per ~1s instead of one per click.
- The producer connection is fail-fast: if Redis is down, the batch is counted as dropped, and
  redirects are unaffected.
- **Graceful shutdown** (`config/lifecycle.ts`) flushes the buffer, so deploys lose nothing. A crash
  loses at most ~1s of clicks, a trade-off stated honestly.

**3. Process (in the worker process, `worker.ts` → `jobs/workers/index.ts`):**
`jobs/processors/click.processor.ts → processClickBatch()`:
- Drop bots (link previewers: Slack, WhatsApp, curl…) via `utils/analytics/userAgent.ts`.
- Parse the user agent with `bowser` → browser, OS, device. Keep only the referrer's **host**.
- **One SQL statement** does everything:
  ```sql
  WITH inserted AS (
    INSERT INTO clicks (...) SELECT ... FROM unnest($ids, $urlIds, ...)   -- the whole batch
    WHERE EXISTS (SELECT 1 FROM urls ...)                                -- skip deleted links
    ON CONFLICT (id) DO NOTHING                                          -- already inserted? skip
    RETURNING url_id, occurred_at
  ), per_url AS (SELECT url_id, count(*) ... FROM inserted GROUP BY url_id)
  UPDATE urls SET click_count = click_count + n ...                      -- only NEW rows count
  ```
- **The key idea, exactly-once effect on an at-least-once queue:** BullMQ can run a job twice
  (the worker dies after committing, before acknowledging). The click `id` comes from the
  producer, so on the second run every insert conflicts, `inserted` is empty, and **no counter
  moves**. Tested: processing the same batch twice leaves the counts unchanged.
- UUIDv7 (not v4) keys: they start with a timestamp, so inserts land at the end of the index.

**4. Read stats:** `GET /api/urls/:code/stats?days=30&tz=Asia/Kolkata`
(`services/stats.service.ts`):
- Owner check first (someone else's link → 404).
- `services/timeZone.service.ts` maps browser zone names (Chrome sends `Asia/Calcutta`) to the name
  Postgres knows (`Asia/Kolkata`), falling back to UTC. **This was a real bug found in browser
  testing** (the stats endpoint returned a 500 for India).
- By day: `generate_series` makes every day in the range (zero-filled, so the chart has no gaps),
  `LEFT JOIN`ed with `date_trunc('day', occurred_at AT TIME ZONE tz)` counts, and `count(DISTINCT
  visitor)` for uniques.
- Top 10 referrers / browsers / OS / devices / countries: 5 queries in parallel, each an index
  range scan on `(url_id, occurred_at)`.
- Cached in Redis for 60 seconds.

**5. Show:** `components/stats/StatsPanel.tsx` (range switch 7/30/90 synced to `?days=`, KPIs,
chart, breakdowns), `ClicksChart.tsx` (Recharts, lazy-loaded), `BreakdownList.tsx`.

### Flow E: authentication

**Register / login** (`routes/auth.route.ts` → `controllers/auth.controller.ts` →
`services/auth.service.ts`):
1. Validate with `registerSchema` / `loginSchema` (email lowercased).
2. Register: bcrypt-hash the password (`utils/auth/password.ts`), create the user (a duplicate email
   → 409).
3. Login: find the user. **If the email doesn't exist, still run a bcrypt compare against a dummy
   hash**, so response time doesn't reveal which emails are registered. The same message for both
   cases: "Email or password is incorrect".
4. `startSession()`: create a `sessions` row with a random `refreshJti`, then sign two JWTs
   (`utils/auth/jwt.ts`):
   - **Access token** (15 min): `{ userId, sessionId }`.
   - **Refresh token** (30 days): `{ sessionId }` + `jti`, signed with a *different* secret.
5. Set both as **httpOnly cookies** (`utils/auth/cookies.ts`): JavaScript can't read them (XSS can't
   steal them). `SameSite=Lax`, `Secure` in production. The refresh cookie's path is `/api/auth`,
   so it's only sent to auth endpoints.

**Every authenticated request:** `middleware/authenticate.ts` verifies the access JWT **and checks
the session row still exists**, so logout takes effect immediately, not in 15 minutes.

**Refresh with rotation and reuse detection** (`auth.service.ts → refresh()`):
- A valid refresh → a new `jti` is stored (atomically: `updateMany where refreshJti = old`), and new
  tokens are issued. The session slides forward 30 days.
- **An old refresh token presented again = it was stolen** → the whole session is deleted.
- Exception: within **30 seconds** of a rotation, the previous token is accepted. Two browser tabs
  refreshing at the same moment would otherwise log the user out.

**The silent refresh in the browser** (`apps/web/src/lib/api.ts`): when any request gets a 401,
the axios interceptor calls `GET /auth/refresh` **once** (concurrent 401s share one promise), then
replays the original request. If the refresh fails, the auth store becomes "guest". Tested: 3
concurrent 401s → exactly 1 refresh.

**Session state in the web app:** `components/auth/AuthLoader.tsx` calls `/auth/me` once and writes
`authenticated` or `guest` into `store/auth.store.ts`. `ProtectedRoute` sends guests to
`/login?next=…` (`lib/safeNext.ts` blocks open redirects like `?next=https://evil.com`).
`PublicOnly` sends logged-in users away from the login and register pages.

**Logout:** deletes the session (found via the access *or* the refresh cookie, so it works even
with an expired access token), clears the cookies, and sets the store to guest with
`reason: "logout"`, so the dashboard guard doesn't bounce you to the login page.

**Why client-side auth checks, not Next middleware:** the cookies belong to the API's domain;
Next's server can't see them. `/auth/me` is the single source of truth.

### Flow F: managing links (owner only)

`services/urlManagement.service.ts`:
- **List:** `findMany` + `count` in **one transaction**, so the page and the total agree. Newest
  first, using the `(user_id, created_at DESC)` index. Returns `meta: { page, limit, total, hasMore }`.
- **Get / update / delete:** every query is scoped by **both** `shortCode` and `userId`. Someone
  else's link returns **404, not 403** (a 403 would confirm it exists).
- Update uses `updateMany({ where: { shortCode, userId } })` and checks `count === 1`: **the ownership
  check is part of the write**, with no read-then-write race.
- **Soft delete:** status becomes `deleted` and the row stays 30 days, so nobody can immediately
  re-register a popular alias and hijack traffic from old printed links.
- **Cache invalidation after every edit** (`utils/cache/urlCache.ts → invalidateUrl`): delete the
  key now, **and again 2 seconds later** ("delayed double delete"). Why twice: another instance
  might have read the old row just before our write and cached it just after; the second delete
  removes that stale value.

In the web app: `LinksList.tsx` (a table from 768px, cards on phones), `LinkActions.tsx` (menu),
`EditLinkDialog.tsx`, `DeleteLinkDialog.tsx`. `hooks/urls/useDeleteUrl.ts` is **optimistic**: the
row disappears immediately and is restored if the request fails.

### Flow G: rate limiting

`utils/rateLimiter/` + `middleware/rateLimiter.ts` + `config/rateLimiter.ts`.

- **Algorithm: sliding-window counter.** `estimate = previousWindow × (1 − elapsed) + currentWindow`.
  Two numbers per key, and no burst at the window boundary (a fixed window allows 2× the limit
  across it). Tested with a controlled clock.
- **Atomic in Redis:** one Lua script (`slidingWindow.ts`) reads, checks and increments in a single
  round trip, run with `EVALSHA`. Keys use a `{hash tag}` so all three keys (current, previous,
  block) land in one Redis Cluster slot.
- **Global:** stored in Redis, so every API instance shares the limit.
- **Fails open:** if Redis is down, `redisStore.ts` falls back to an in-memory store (per-instance
  limits) via a circuit breaker, and logs this **once** per transition, not per request.

| Limiter | Where | Limit | Store |
|---|---|---|---|
| create | `POST /api/urls` | 10/h anonymous (IP), 60/h user | Redis |
| login | `/api/auth/login` | 10 / 15 min per IP+email, then blocked 1h | Redis |
| register | `/api/auth/register` | 10 / 15 min per IP, then blocked 1h | Redis |
| api | all `/api` | 300 / 5 min per IP | Redis |
| redirect | `GET /:code` | 600 / min per IP | **memory** |
| miss | not-found redirects | 60 / min → blocked 10 min | **memory** |

- **Why redirects use memory:** a Redis limiter would add a second network round trip to the
  hottest path. Per-instance limits are approximate but free.
- **The miss limiter** targets code enumeration: scanners produce mostly not-found results, real
  visitors almost never do. It blocks scanners without ever throttling a popular link.
- **Client IP:** only `req.ip` (correct once `trust proxy` is set); never read `X-Forwarded-For`
  directly, since anyone can send one. IPv6 is bucketed by `/64`, because one user owns a whole /64.

### Flow H: errors, end to end

- **API:** services throw `AppError(status, message, code)` (`utils/errors/`), usually via
  `appAssert(condition, …)`. Controllers are wrapped in `catchError`.
  `middleware/errorHandler.ts` converts everything into the envelope
  `{ status: "error", data: null, errors: [{ message, code, path? }] }`: ZodError → 400 with one
  error per field; AppError → its status; Prisma `P2002` → 409; `P2025` → 404; bad JSON → 400;
  too large → 413; anything else → logged, 500 "Internal Server Error" (internals never leak).
- **Redirect errors** return a small **HTML** page (503), not JSON: a person clicked a link.
- **Web:** `lib/errors.ts → toApiError` turns every axios error into one `ApiError` type
  (a network failure → "Can't reach the server"; a 5xx → "Something went wrong. Try again."). Then,
  per layer: form fields, a form-level alert, toasts for mutations, an `ErrorState` with a Retry
  button for failed queries, and `error.tsx` / `global-error.tsx` for render crashes.

### Flow I: startup, health and shutdown

- `index.ts → main()`: `connectDB()` (fail the boot early if Postgres is unreachable) →
  `waitForCache()` (up to 2s; the cache is optional) → `createApp()` → `listen` → start the click
  recorder and the metrics server → `registerShutdown()`.
- `constants/env.ts`: `getEnv(key, default)` reads each variable into an exported constant
  (`PORT`, `DATABASE_URL`…) and checks it at boot: missing, malformed, a secret under 32
  characters, identical JWT secrets, or invalid short-code keys all stop the process with a
  message naming the variable.
- `/health/live`: 200 while the process runs (no dependency checks).
  `/health/ready`: 200 only if Postgres answers within 1s and we're not shutting down; it
  **reports** the cache but doesn't require it.
- **Graceful shutdown** (`config/lifecycle.ts`), on SIGTERM/SIGINT: readiness → 503, stop accepting
  connections, let in-flight requests finish, then run the cleanup steps in stages:
  `flush` (click buffer) → `queues` → `redis` → `db`. A 10s timeout forces an exit.

### Flow J: housekeeping (Postgres has no TTL index)

`jobs/queues/maintenance.queue.ts` schedules an hourly BullMQ job (`upsertJobScheduler`, so it's
idempotent). `jobs/processors/maintenance.processor.ts → runPurge()` deletes, **in batches** (so
no statement holds locks for long):
- links past `purge_at` (30 days after expiry or deletion; partial index `WHERE purge_at IS NOT NULL`),
- expired sessions,
- clicks older than 180 days.

**Why keep expired links 30 days:** visitors see "This link has expired" instead of "not found",
and nobody can re-claim the alias right away.

### Flow K: how the frontend is built

- **Server vs Client Components:** pages and layouts are Server Components (static HTML, metadata).
  Anything with state, hooks or data is a Client Component (`"use client"`), pushed as far down as
  possible. The landing page is a server page containing a client `ShortenForm`.
- **Data fetching is client-side via TanStack Query**, because the auth cookie belongs to the API's
  domain. Each API operation has **one API function** (`src/api/`) and **one hook**
  (`src/hooks/`): 10 of each.
- `lib/queryClient.ts`: a factory (one client per browser tab; a module-level client would share
  its cache across users' requests during server rendering). It never retries 4xx errors. The
  global `onError` shows a toast when a background refetch fails while data is on screen.
- `lib/queryKeys.ts`: key factories, so invalidation can't typo.
- **Zustand only for session state** (`auth.store`) and guests' recent links. Server data never
  goes in Zustand.
- **Design system** (`packages/ui`): `tokens.css` defines every colour for light and dark; all of
  them pass WCAG AA contrast. `globals.css` turns them into Tailwind v4 utilities (`bg-card`,
  `text-display`, `rounded-card`…). Primitives (Button, Field, Dialog…) are built on Radix.
  `ResponsiveDialog` becomes a bottom sheet on phones.
- **Accessibility:** labelled fields with errors linked via `aria-describedby`, visible focus
  rings, status shown as a word plus a shape (never colour alone), 44px touch targets, a skip link,
  and a "View as table" alternative for the chart.

---

## 5. The database

Defined in `apps/api/prisma/schema.prisma`. The history is in `prisma/migrations/` (committed; the
SQL files are hand-edited where Prisma's schema language can't express something).

| Table | Key columns | Indexes and constraints |
|---|---|---|
| `urls` | `id BIGINT` (from the block allocator), `short_code`, `long_url`, `user_id`, `status` (active/disabled/deleted), `expires_at`, `purge_at`, `click_count`, `last_clicked_at` | **unique** `short_code`; `(user_id, created_at DESC)`; **partial** `purge_at WHERE NOT NULL`; **CHECK** code format, `http(s)://` only, `purge_at > expires_at` |
| `users` | `id UUIDv7`, `email` (lowercase), `password_hash`, `name` | unique `email`; **CHECK** `email = lower(email)` |
| `sessions` | `id`, `user_id`, `refresh_jti`, `previous_jti`, `rotated_at`, `expires_at` | FK → users `ON DELETE CASCADE`; indexes on `user_id`, `expires_at` |
| `clicks` | `id UUIDv7` (idempotency key), `url_id`, `occurred_at`, `referrer_host`, `browser`, `os`, `device`, `country`, `visitor` | `(url_id, occurred_at)`; FK → urls `ON DELETE CASCADE` |
| sequence | `url_id_block_seq INCREMENT BY 1000` | one `nextval` = one block of 1,000 ids |

- **snake_case in SQL, camelCase in TypeScript** (Prisma `@map`).
- **`timestamptz` everywhere**, because stats group by the viewer's time zone.
- **CHECK constraints** mean the database enforces the rules even for raw SQL or a buggy code path.
- `users` → `urls` is `ON DELETE SET NULL`: deleting an account keeps its links, now anonymous.

---

## 6. Every file, explained

### Root
| File | What it does |
|---|---|
| `package.json` | Root scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `format`) that run through Turborepo; pins TypeScript 5.9.3 |
| `pnpm-workspace.yaml` | Workspace packages; pnpm 11's `allowBuilds` (which dependencies may run install scripts); a longer fetch timeout |
| `turbo.json` | Task graph; `db:generate` runs before typecheck/test/build/dev; env vars passed to tasks |
| `docker-compose.yml` | Postgres 18 (host port 5433) + Redis queue (6379, noeviction) + Redis cache (6380, allkeys-lru) |
| `infra/postgres/init/01-test-database.sql` | Creates `url_shortener_test` on the first start |
| `.editorconfig`, `.prettierrc`, `.prettierignore`, `.nvmrc`, `.gitignore` | Formatting, Node version, ignored files |
| `README.md` | How to run; `tracking.md`: phase status |

### `packages/types` (the shared contract)
| File | What it does |
|---|---|
| `src/envelope.ts` | `ApiEnvelope<T>`, `ApiError`, `PaginationMeta`: the shape of every response |
| `src/url.ts` | `createUrlSchema`, `updateUrlSchema`, `listUrlsQuerySchema`, `UrlDto` |
| `src/auth.ts` | `registerSchema`, `loginSchema` (password 8–72 chars: bcrypt's limit), `UserDto` |
| `src/stats.ts` | `statsQuerySchema` (days 1–90, a valid time zone), `UrlStatsDto` |
| `src/index.ts` | Re-exports everything (only `zod` may be imported here) |

### `packages/ui` (the design system)
| File | What it does |
|---|---|
| `src/styles/tokens.css` | Every colour, for light (`:root`) and dark (`.dark`); shadows |
| `src/styles/globals.css` | Tailwind v4 setup: maps tokens to utilities; type scale, radii, breakpoints, motion; base styles; reduced motion |
| `src/lib/utils.ts` | `cn()`: merges class names, taught about our custom utilities |
| `src/lib/focus.ts` | The one focus-ring style every control uses |
| `src/hooks/use-media-query.ts` | SSR-safe media query hook |
| `src/components/button.tsx` | Pill buttons: variants, sizes (44px on touch), loading state |
| `input.tsx` · `label.tsx` · `field.tsx` | Inputs (16px, so iOS doesn't zoom), a prefixed input (`snip.to/`); `Field` wires label, hint, error and ARIA |
| `badge.tsx` | Status badges (Active / Disabled / Expired: a word plus a distinct shape) |
| `dialog.tsx` · `responsive-dialog.tsx` | Dialog, and a bottom sheet under 768px |
| `dropdown-menu.tsx` · `tooltip.tsx` · `segmented-control.tsx` · `switch.tsx` · `table.tsx` | Radix-based primitives |
| `skeleton.tsx` · `spinner.tsx` · `empty-state.tsx` · `error-state.tsx` | Loading, empty and error states |

### `apps/api`: entry points and config
| File | What it does |
|---|---|
| `src/index.ts` | API process: connect, wait for cache, listen, start the click recorder and metrics, graceful shutdown |
| `src/worker.ts` | Worker process: consumes click batches, schedules the hourly purge |
| `src/app.ts` | `createApp()`: the middleware order and routes (separate from `listen`, so tests can use it) |
| `src/config/db.ts` | Prisma client with the `pg` driver adapter; `connectDB`, `pingDB` |
| `src/config/redis.ts` | Fail-fast Redis clients (cache, limiter); `waitForCache` |
| `src/config/lifecycle.ts` | Shutdown registry with ordered stages |
| `src/config/rateLimiter.ts` | The six limiter instances |
| `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/` | Database schema, Prisma 7 config, migration history |
| `build.mjs` | Production bundle with esbuild (`pnpm --filter api build` → `dist/`) |
| `scripts/genShortcodeKeys.ts` | Generates valid permutation keys |
| `scripts/genTimeZoneAliases.ts` | Builds `constants/timeZoneAliases.json` from Postgres's tzdata |

### `apps/api`: constants
| File | What it does |
|---|---|
| `constants/env.ts` | `getEnv()` + one exported constant per variable, each checked at boot (fails fast); validates `SHORTCODE_KEYS` |
| `constants/http.ts` · `appErrorCode.ts` | Status codes; machine-readable error codes |
| `constants/cache.ts` · `queue.ts` · `rateLimiter.constant.ts` | TTLs, breaker thresholds; queue names, flush sizes; limiter prefixes and headers |
| `constants/reservedCodes.ts` | Aliases nobody may claim (`api`, `login`, `dashboard`…) |
| `constants/timeZoneAliases.json` | 162 tz links (e.g. `Asia/Calcutta → Asia/Kolkata`) |

### `apps/api`: routes → controllers → services
| File | What it does |
|---|---|
| `routes/url.route.ts` | `POST/GET /api/urls`, `GET/PATCH/DELETE /api/urls/:code`, `GET /api/urls/:code/stats` |
| `routes/auth.route.ts` | register, login, refresh, logout, me |
| `routes/redirect.route.ts` | `GET /` → website, `GET /:code` → redirect (mounted last) |
| `routes/health.route.ts` | `/health/live`, `/health/ready` |
| `routes/admin.route.ts` | Bull Board queue dashboard (development only, basic auth) |
| `controllers/*.ts` | Thin: parse input with Zod → one service call → envelope response |
| `services/url.service.ts` | Create links (alias rules, retry, expiry, write-through), `toUrlDto` |
| `services/redirect.service.ts` | Resolve a code: cache → single-flight → Postgres |
| `services/urlManagement.service.ts` | List/get/update/soft-delete, owner-scoped, with invalidation |
| `services/auth.service.ts` | Register, login, refresh rotation, logout, me |
| `services/stats.service.ts` | Stats queries, owner check, 60s cache |
| `services/timeZone.service.ts` | Maps browser zone names to Postgres ones |
| `services/idAllocator.service.ts` | Block allocation of ids from the sequence |
| `services/purge.service.ts` | Batched deletes of expired links and sessions |

### `apps/api`: middleware and utils
| File | What it does |
|---|---|
| `middleware/authenticate.ts` | `authenticate` (required), `optionalAuth`, `tryAuth` (logout) |
| `middleware/errorHandler.ts` · `notFound.ts` | Every error → the envelope; unknown routes → 404 |
| `middleware/rateLimiter.ts` | `createRateLimiter` factory + `createMissLimiter`, 429 responses |
| `middleware/requestId.ts` · `metrics.ts` | Request ids (reuse a safe incoming one); request timing |
| `utils/api/apiEnvelope.ts` | `ok()` and `fail()` |
| `utils/errors/*` | `AppError`, `appAssert`, `catchError`, `isPrismaError` |
| `utils/auth/*` | JWT sign/verify, cookie settings, bcrypt + dummy-hash compare |
| `utils/cache/*` | `urlCache`, `circuitBreaker`, `singleFlight`, `ttlFor`, `invalidateUrl` |
| `utils/rateLimiter/*` | Lua sliding window, Redis store (fails open), memory store, IP extraction |
| `utils/shortCode/*` | `base62`, `permute`, `validate`, `generateShortCode` |
| `utils/analytics/*` | Bot filter, user-agent parsing, referrer host; daily visitor hash |
| `utils/url/normalize.ts` | Canonicalise the URL; reject our own domains |
| `utils/uuidv7.ts` · `logger.ts` · `metrics/metrics.ts` | Time-ordered ids; pino with redaction; Prometheus metrics |
| `jobs/producers/clickRecorder.ts` | The in-memory click buffer |
| `jobs/queues/*.ts` · `jobs/redis/connection.ts` | BullMQ queues; producer (fail-fast) vs worker connections |
| `jobs/processors/*.ts` · `jobs/workers/index.ts` | The idempotent batch insert; the purge; worker setup |

### `apps/web`
| File | What it does |
|---|---|
| `app/layout.tsx` · `app/providers.tsx` | Fonts, skip link, metadata; Theme, Query, Tooltip providers, AuthLoader, Toaster |
| `app/page.tsx` | Landing page (hero + shorten form, recent links, benefits, use cases, CTA) |
| `app/(auth)/login`, `register`, `layout.tsx` | Auth pages (wrapped in `PublicOnly`) |
| `app/dashboard/layout.tsx` · `page.tsx` · `loading.tsx` | Protected shell; your links; skeleton |
| `app/dashboard/links/[code]/page.tsx` | Link detail and analytics |
| `app/expired`, `not-found.tsx`, `error.tsx`, `global-error.tsx` | System pages |
| `lib/api.ts` · `lib/errors.ts` | The axios instance with the silent-refresh interceptor; `ApiError` |
| `lib/queryClient.ts` · `queryKeys.ts` · `forms.ts` · `format.ts` · `safeNext.ts` · `shortDomain.ts` | Query setup, keys, server field errors → form, number/date formatting, open-redirect guard, alias prefix |
| `api/*.ts` | One function per API endpoint |
| `hooks/**` | One TanStack Query hook per operation; `useCopy` for the clipboard |
| `store/auth.store.ts` · `recentLinks.store.ts` | Session state; guests' recent links (localStorage) |
| `components/auth/*` | AuthLoader, ProtectedRoute, PublicOnly, Login/Register forms, PasswordInput, FormAlert |
| `components/layout/*` | Headers, footer, user menu, theme toggle, toaster, message page |
| `components/urls/*` | ShortenForm, ShortLinkResult, LinksList, LinkActions, dialogs, CopyButton, QrCodeDialog, StatusBadge, Pagination, RecentLinks, LinkDetail |
| `components/stats/*` | StatsPanel, ClicksChart, BreakdownList |

---

## 7. How it is tested

- **API: 122 tests** (`apps/api/test/`), run with Vitest **against real Postgres and Redis** (a
  separate `url_shortener_test` database and Redis database index 1), because the behaviour that
  matters (CHECK constraints, `ON CONFLICT`, sequences, Lua scripts, time zones) only exists in the
  real engines. Test files run one at a time; each test truncates its tables.
- **Web: 13 tests** (`apps/web/test/`), run with Vitest + Testing Library + jsdom: error mapping,
  the refresh interceptor, the shorten form, the optimistic delete.
- **Highlights worth mentioning:** 1M distinct codes; 5,000 parallel id allocations; 50 concurrent
  cold requests → 1 query; redirects with Redis disconnected; the breaker opening and recovering
  (with a controlled clock); a retried click batch not double-counting; refresh-token reuse
  revoking the session; the graceful-shutdown test sends SIGTERM to a real process.
- **Manual verification:** 9 real-browser journeys and an accessibility/layout audit at 8 screen
  widths in both themes. These found and fixed real bugs: a missing input label for screen
  readers, the time-zone 500, logout redirecting to the login page, and pages overflowing on phones.

---

## 8. Interview questions and answers

**How do you guarantee short codes don't collide?**
Ids come from a Postgres sequence (unique by definition), and each id goes through a *bijection*
(two affine maps with multipliers coprime to 62⁷, around a digit reversal), so distinct ids give
distinct codes. Custom aliases are the only other source of codes, and the unique constraint
catches those; a clash triggers a retry with the next id.

**Why not random codes, or a hash of the URL?**
Random codes can collide (birthday problem), so you need detection plus retry anyway, and they give
no guarantee. A hash gives the same code for the same URL, which breaks per-campaign links, and it
can still collide once truncated. The sequence plus permutation gives "cannot collide" with
random-looking codes.

**Why allocate ids in blocks of 1,000?**
One database round trip per 1,000 links instead of per link, and it still works across many API
instances, because `nextval` is atomic. It lives in Postgres, not Redis, so creating links keeps
working if Redis is down.

**What happens when Redis goes down?**
Redirects: the fail-fast client rejects immediately, the circuit breaker opens after 5 failures, and
lookups go straight to Postgres, with zero errors. Rate limits fall back to per-instance memory.
Clicks: batches are dropped and counted; redirects are unaffected.

**What's a cache stampede, and how do you prevent it?**
A popular key expires and hundreds of requests hit the database at once. Single-flight makes
concurrent misses in one process share one query, and TTL jitter (±10%) keeps keys loaded at the
same time from expiring at the same time.

**Why negative caching? What's the risk?**
Scanners try random codes; without it, every miss is a database query. The risk: someone visits
`/sale` (cached as missing for 60s), then a user creates the alias `sale`. Write-through on create
overwrites the negative entry, so the new link works immediately.

**How do you keep the cache consistent after an edit?**
Delete the key after the database write, and delete it again 2 seconds later, to clear a stale value
another instance may have written between its read and our write.

**Why are clicks recorded asynchronously? What could be lost?**
The redirect must not wait on a database write. Clicks are buffered in memory for up to ~1s: a
graceful shutdown flushes them, but a crash could lose up to ~1s. That's an acceptable trade-off for
analytics, and it's measured (a dropped-clicks metric).

**BullMQ can run a job twice. How do you avoid double counting?**
Each click has a UUID assigned by the producer, which is also the table's primary key. The batch
insert uses `ON CONFLICT (id) DO NOTHING RETURNING`, and the counter update in the same statement
only counts rows actually inserted. A replayed batch changes nothing: an exactly-once effect.

**How do you count unique visitors without storing IPs?**
An HMAC of the IP with a secret, keyed by the date. It can't be reversed or linked across days;
`count(DISTINCT visitor)` per day gives unique visitors.

**Why JWTs in httpOnly cookies and not localStorage?**
JavaScript can't read httpOnly cookies, so an XSS bug can't steal the token. `SameSite=Lax`, a
strict CORS allowlist and JSON-only bodies cover CSRF.

**If JWTs are stateless, how does logout work immediately?**
Each token carries a session id, and `authenticate` checks that the session row still exists. Logout
deletes the row. It costs one primary-key lookup, only on API routes; redirects never authenticate.

**What's refresh-token rotation and reuse detection?**
Every refresh issues a new refresh token and records its id. If an older token shows up again, it
must have been copied, so the whole session is revoked. There's a 30-second grace window for two
tabs refreshing at the same time.

**Why a sliding-window counter for rate limiting?**
A fixed window allows up to 2× the limit around the boundary; a sliding log stores every request.
The sliding counter needs two integers per key and is accurate enough. It runs as one Lua script,
so the check and increment are atomic.

**Why aren't redirects limited through Redis?**
It would double the network round trips on the hottest path. In-memory limits cost nothing. They're
per instance (so approximate), and the miss limiter targets the actual attack: enumeration.

**Why 302 instead of 301?**
301s are cached by browsers indefinitely: repeat clicks never reach you (no analytics), and you
can't disable or expire the link. 302 plus `Cache-Control: no-store` keeps control.

**Why soft delete?**
To stop someone re-registering a deleted popular alias and capturing traffic from old printed or
shared links. Rows are purged 30 days later.

**How does the web app handle an expired access token?**
The axios interceptor catches the 401, calls refresh once (concurrent 401s wait on the same
promise), and replays the request. The user never notices.

**Server Components vs Client Components here?**
Pages and layouts are Server Components; data fetching is in Client Components with TanStack Query,
because the session cookie belongs to the API's domain, not Next's.

**How is the API structured?**
Route → controller (parse with Zod, call one service, return the envelope) → service (business
rules) → Prisma. Errors are thrown as `AppError`, and one central error handler formats every
response. `createApp()` is separate from `listen()`, so tests use the app directly.

**What was the hardest bug?**
The stats endpoint returned 500 for users in India: Chrome reports the time zone as `Asia/Calcutta`
(a legacy name), which JavaScript accepts, but the Postgres image doesn't ship legacy zone names.
I found it in a real-browser test and fixed it with an alias table generated from Postgres's own
tzdata, falling back to UTC.

---

## 9. Honest limits (what is not built)

Say these clearly if asked. It shows judgement.

- **No horizontal-scaling setup, load tests, CI or deployment:** these phases were cut from scope.
  The app is *designed* stateless: sessions and limits live in Postgres/Redis, and the per-instance
  pieces (id blocks, the click buffer, in-memory limiters) are either safe or explicitly
  approximate. But multi-instance running wasn't demonstrated, and there are no measured latency
  numbers. Don't quote any.
- **Metrics exist** (`/metrics` on port 9100: request durations, cache hits, rejections, breaker
  state, clicks), but no Prometheus or Grafana is set up.
- **No search, sort or filter** on the links list (the API doesn't support them yet); no account
  overview totals or cross-link analytics.
- **Country analytics** only work behind Cloudflare (the `cf-ipcountry` header).
- **The short-code permutation is obfuscation, not secrecy.**
