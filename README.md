# snip: a URL shortener with click analytics

Shorten any link, share it anywhere, and see who clicks: where they came from, on what device,
and when. A full-stack TypeScript project: an **Express + PostgreSQL (Prisma) + Redis** API, a
**BullMQ** analytics worker, and a **Next.js** web app, in a **pnpm + Turborepo** monorepo.

**135 automated tests** (122 API tests against real Postgres and Redis, 13 web tests) ·
verified in a real browser · WCAG AA · light and dark themes · mobile-first

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Testing](#testing)
- [How it was built](#how-it-was-built)
- [Limitations](#limitations)
- [Further reading](#further-reading)

---

## Features

### For users
- **Shorten links instantly.** No account needed. Paste a URL (a missing `https://` is added for
  you) and get a 7-character link to copy.
- **Custom aliases** (`snip.to/launch`) and **expiry dates** (1, 7 or 30 days, or a custom time) for
  logged-in users.
- **QR codes** for every link, downloadable as PNG or SVG.
- **Dashboard:** every link with its clicks and status; copy, edit the expiry, disable or re-enable,
  and delete (with confirmation).
- **Per-link analytics:** clicks and unique visitors per day in *your* time zone (7, 30 or 90
  days), plus top referrers, devices, browsers, operating systems and countries. A "view as table"
  option is available for accessibility.
- **Accounts:** register, log in, stay logged in securely, and log out everywhere at once.
- **Guest history:** without an account, your recent links are remembered in this browser.
- **Light and dark themes,** following your system or chosen manually.
- **Works on any screen:** phone layouts are designed, not shrunk. Tables become cards and dialogs
  become bottom sheets.

### Under the hood
- **Collision-free short codes:** ids come from a Postgres sequence, handed out in blocks of 1,000,
  and pass through a mathematically proven one-to-one scramble (a bijective permutation), so codes
  look random but can never collide.
- **Fast, resilient redirects:** a Redis cache with negative caching, request coalescing (50
  simultaneous misses → 1 database query) and a circuit breaker. **Redirects keep working with
  Redis down.**
- **Analytics that never slow a redirect:** clicks are buffered in memory and processed by a
  separate worker in batches. Retried jobs **never double-count** (idempotent SQL).
- **Privacy-preserving analytics:** raw IPs are never stored; unique visitors are counted with a
  daily-rotating keyed hash.
- **Rate limiting:** Redis sliding-window limits shared by all API instances, which fall back to
  per-instance limits if Redis is down. A dedicated limiter blocks code-scanning bots.
- **Secure auth:** JWTs in httpOnly cookies, server-side sessions, refresh-token rotation with
  reuse detection, and timing-safe login.
- **Production basics:** validated configuration, structured logs with request ids, Prometheus
  metrics, health checks, and graceful shutdown that loses no buffered clicks.

---

## Tech stack

| Layer | Technology |
|---|---|
| **API** | Node.js 22, Express 5, TypeScript 5.9, Zod 4 |
| **Database** | PostgreSQL 18 via Prisma 7 (with the `pg` driver adapter) |
| **Cache & queues** | Redis 7 (two instances), ioredis 6, BullMQ 6 |
| **Web** | Next.js 16 (App Router), React 19, TanStack Query 5, Zustand 5, React Hook Form |
| **UI** | Tailwind CSS 4, Radix UI primitives, Recharts, lucide icons, a custom design system |
| **Auth** | jsonwebtoken, bcrypt, httpOnly cookies |
| **Observability** | pino (structured logs), prom-client (Prometheus metrics) |
| **Tooling** | pnpm 11 workspaces, Turborepo, ESLint 9, Prettier, Vitest 5, Testing Library, Docker Compose |

---

## Architecture

```
                 ┌─────────────────────── Next.js web app (:3000) ───────────────────────┐
  Browser ──────▶│ pages · TanStack Query hooks · axios with cookies · design system     │
     │           └───────────────────────────────┬───────────────────────────────────────┘
     │                                           │ /api/* (JSON, cookies)
     │ GET /:code (a short link)                 ▼
     └──────────────────────────────▶  Express API (:4000) ───────▶ /metrics (:9100)
                                        │         │        │
                          1 cache read  │         │        │ rate limits, click batches
                                        ▼         ▼        ▼
                              Redis cache    PostgreSQL    Redis queue ◀──── Worker process
                              (allkeys-lru)  (Prisma)      (noeviction)      (BullMQ)
                                                 ▲                              │
                                                 └──── batched idempotent inserts
```

- **Two Redis instances,** because they need opposite eviction policies: the cache *must* evict to
  stay bounded, and the queue *must never* evict (that would lose jobs).
- **A separate worker process** does the heavy analytics work, so redirects never wait for it.
- **The web app is frontend-only.** It has no API routes or server actions: the Express API is the
  single backend, and short links never pass through Next.js.

---

## How it works

### Creating a link
1. The form validates with the **same Zod schema the API uses** (`packages/types`), so the client and
   server can't disagree.
2. `POST /api/urls` → optional auth → rate limit → validation → service.
3. The service rejects this service's own domain (no redirect loops), clamps anonymous expiry to 30
   days, then takes an id from the block allocator and turns it into a code. A clash with a custom
   alias retries with the next id.
4. The new link is written into the cache immediately (write-through).

### Short codes, and why they can't collide
```
Postgres sequence (blocks of 1,000)  →  id  →  affine → reverse digits → affine  →  Base62  →  "McTYOWd"
```
Each affine step, `x ↦ (x·P + C) mod 62⁷`, is one-to-one when `P` shares no factor with 62⁷ (odd,
and not divisible by 31); the app refuses to start otherwise. Reversing the digits is also one-to-one.
A chain of one-to-one maps is one-to-one, so **distinct ids always give distinct codes**. Tested on
1,000,000 ids.

### Redirecting (`GET /:code`)
1. Junk paths (`/wp-login.php`) are rejected before touching any database.
2. **Cache hit:** one Redis read, no SQL, then `302`.
3. **Cache miss:** concurrent requests for the same code share **one** Postgres query; the result is
   cached with a jittered TTL (never longer than the link's lifetime). Unknown codes are cached as
   "missing" for 60 seconds, so scanners can't hammer the database.
4. **Redis down:** the client fails fast, a circuit breaker stops calling Redis after 5 failures,
   and redirects are served from Postgres, with zero errors.
5. `302` with `Cache-Control: no-store` (not `301`), so every click is counted, and disabling a
   link takes effect immediately.

### Recording clicks
1. The redirect adds the click to an in-memory buffer (no I/O, no waiting).
2. Every second (or every 500 clicks), the buffer is sent to BullMQ as **one** job.
3. The worker drops bots, parses the browser/OS/device, and writes the batch with a single SQL
   statement: `INSERT … ON CONFLICT (id) DO NOTHING RETURNING`, followed by a counter update for
   only the rows actually inserted. **A retried job changes nothing.**
4. Stats queries group clicks by day **in the viewer's time zone**, with empty days filled in, and
   are cached for 60 seconds.

### Authentication
- Login issues a 15-minute **access token** and a 30-day **refresh token**, both in httpOnly
  cookies, backed by a `sessions` row, so logout and revocation take effect immediately.
- Every refresh **rotates** the refresh token; presenting an old one revokes the session (theft
  detection), with a 30-second grace period for two tabs refreshing at once.
- In the browser, an axios interceptor refreshes **silently** on a 401 (one refresh even for many
  failed requests) and replays the request.

### Rate limits

| Limit | Applies to | Rule |
|---|---|---|
| Link creation | `POST /api/urls` | 10/hour per IP (guests), 60/hour per user |
| Login | `POST /api/auth/login` | 10 per 15 min per IP+email, then blocked for 1 hour |
| Registration | `POST /api/auth/register` | 10 per 15 min per IP, then blocked for 1 hour |
| API | all `/api` | 300 per 5 min per IP |
| Redirects | `GET /:code` | 600/min per IP (in memory, no network cost) |
| Scanners | not-found redirects | 60/min per IP → blocked for 10 minutes |

For the full step-by-step explanation of every flow and every file, see
[`gothrough.md`](gothrough.md).

---

## Getting started

### Prerequisites
- **Node.js 22+** and **pnpm 11** (`corepack enable`)
- **Docker** (Docker Desktop on Windows/macOS; on WSL, turn on its WSL integration)

### First-time setup
```bash
git clone <this-repo> url-shortener && cd url-shortener
pnpm install

docker compose up -d                          # Postgres 18 (port 5433) + two Redis instances

cp apps/api/.env.example apps/api/.env        # then replace the placeholder secrets (see below)
cp apps/web/.env.example apps/web/.env

pnpm --filter api db:deploy                   # create the database tables
```

Generate the secrets `apps/api/.env` needs:
```bash
pnpm --filter api gen:shortcode-keys          # prints SHORTCODE_KEYS=…
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # run 3×: JWT_SECRET, JWT_REFRESH_SECRET, VISITOR_HASH_SECRET
```

### Running it
```bash
docker compose up -d                          # if not already running
pnpm dev                                      # terminal 1: API on :4000, web on :3000
pnpm --filter api worker                      # terminal 2: the analytics worker
```
Open **http://localhost:3000**. Without the worker, links and redirects work, but click
statistics don't update.

To stop: Ctrl+C in both terminals, then `docker compose stop`.

### Useful commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the API and the web app with hot reload |
| `pnpm --filter api worker` | Runs the analytics worker |
| `pnpm typecheck` · `pnpm lint` · `pnpm format` | Checks the whole workspace |
| `pnpm --filter api test` · `pnpm --filter web test` | Runs the tests (the API needs Docker running) |
| `pnpm build` | Production builds (API bundle in `apps/api/dist`, Next.js in `apps/web/.next`) |
| `pnpm --filter api db:migrate` | Creates and applies a new migration after a schema change |
| `pnpm --filter api db:studio` | Opens Prisma Studio to browse the data |

### Troubleshooting

| Problem | Fix |
|---|---|
| `docker: command not found` in WSL | Start Docker Desktop and enable WSL integration for your distro |
| `Invalid environment: …` on start | A variable in `apps/api/.env` is missing or invalid; the message names it |
| Port 3000, 4000 or 5433 in use | Stop whatever uses it (a native Postgres often owns 5432, which is why this uses 5433) |
| Click stats never change | The worker isn't running |

---

## Configuration

`apps/api/.env` (validated at startup; the app refuses to start with a missing or invalid value):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | *(required)* | Postgres connection, e.g. `postgresql://postgres:postgres@localhost:5433/url_shortener` |
| `DATABASE_URL_TEST` | *(tests only)* | The test database, `…/url_shortener_test` |
| `SHORTCODE_KEYS` | *(required)* | Four integers `P1,C1,P2,C2` for the code permutation (`gen:shortcode-keys`) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | *(required)* | Two different random strings, 32+ characters each |
| `VISITOR_HASH_SECRET` | *(required)* | Keys the daily visitor hash, 32+ characters |
| `PORT` | `4000` | API port |
| `SHORT_BASE_URL` | `http://localhost:4000` | The domain short links are served from |
| `WEB_URL` | `http://localhost:3000` | The website (unknown or expired links redirect here) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins allowed to call the API |
| `REDIS_CACHE_URL` / `REDIS_QUEUE_URL` | `redis://localhost:6380` / `:6379` | The two Redis instances |
| `CACHE_ENABLED` | `true` | Kill switch: `false` serves every redirect from Postgres |
| `CACHE_COMMAND_TIMEOUT_MS` | `50` | How long a cache read may take before it counts as failed |
| `DB_POOL_MAX` | `10` | Postgres connections per process |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `TRUSTED_PROXIES` | `loopback` | Express `trust proxy` (so `req.ip` is the real client behind a proxy) |
| `COOKIE_DOMAIN` | — | Set in production when web and API share a parent domain |
| `METRICS_PORT` | `9100` | Prometheus `/metrics` (the worker uses this + 1) |
| `BULL_BOARD_USER`, `BULL_BOARD_PASSWORD` | — | Enable the queue dashboard at `/admin/queues` (development only) |
| `LOG_LEVEL` | `info` | pino log level |

`apps/web/.env`: `NEXT_PUBLIC_API_URL` (default example: `http://localhost:4000`).

---

## API reference

Every JSON response uses one envelope:
```json
{ "status": "success", "data": { }, "meta": { } }
{ "status": "error", "data": null, "errors": [{ "message": "…", "code": "ALIAS_TAKEN", "path": "customAlias" }] }
```

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/urls` | optional | Create a link. Body: `{ url, customAlias?, expiresAt? }` (alias and expiry need login) |
| `GET` | `/api/urls?page=1&limit=20` | required | Your links, newest first; `meta: { page, limit, total, hasMore }` |
| `GET` | `/api/urls/:code` | owner | One link |
| `PATCH` | `/api/urls/:code` | owner | `{ expiresAt?: date \| null, status?: "active" \| "disabled" }` |
| `DELETE` | `/api/urls/:code` | owner | Soft delete (the alias stays reserved for 30 days) |
| `GET` | `/api/urls/:code/stats?days=30&tz=Asia/Kolkata` | owner | Daily clicks and uniques; top referrers, browsers, OS, devices, countries |
| `POST` | `/api/auth/register` | — | `{ name, email, password }` → sets auth cookies |
| `POST` | `/api/auth/login` | — | `{ email, password }` → sets auth cookies |
| `GET` | `/api/auth/refresh` | refresh cookie | Rotates the tokens |
| `POST` | `/api/auth/logout` | — | Ends the session, clears cookies |
| `GET` | `/api/auth/me` | required | The current user |
| `GET` | `/:code` | — | **The redirect:** 302 to the target, `/expired`, or `/not-found` |
| `GET` | `/health/live` · `/health/ready` | — | Liveness; readiness (Postgres reachable, not shutting down) |

Another user's link returns **404, not 403**, so the API never confirms a link exists.

---

## Project structure

```
url-shortener/
├── apps/
│   ├── api/                      Express API + BullMQ worker
│   │   ├── prisma/               schema.prisma + migrations (hand-edited SQL where needed)
│   │   ├── src/
│   │   │   ├── index.ts          API process: boot, listen, graceful shutdown
│   │   │   ├── worker.ts         worker process: click batches, hourly purge
│   │   │   ├── app.ts            createApp(): middleware order and routes
│   │   │   ├── config/           Prisma client, Redis clients, limiters, shutdown lifecycle
│   │   │   ├── constants/        validated env, error codes, cache/queue settings
│   │   │   ├── routes/ → controllers/ → services/     request → validation → business logic
│   │   │   ├── middleware/       auth, errors, rate limiting, request ids, metrics
│   │   │   ├── jobs/             click recorder (producer), queues, processors, workers
│   │   │   └── utils/            cache, circuit breaker, short codes, rate limiter, auth, metrics
│   │   └── test/                 122 tests (Vitest + Supertest, real Postgres and Redis)
│   └── web/                      Next.js frontend
│       ├── src/app/              routes: landing, login, register, dashboard, link analytics
│       ├── src/components/       auth, layout, urls, stats
│       ├── src/hooks/            one TanStack Query hook per API operation
│       ├── src/api/ · lib/ · store/     API functions · axios + errors + query client · Zustand
│       └── test/                 13 tests (Vitest + Testing Library)
├── packages/
│   ├── types/                    Zod schemas + types shared by API and web
│   ├── ui/                       design tokens (light/dark) + Radix-based components
│   ├── eslint-config/ · typescript-config/
├── docker-compose.yml            Postgres + two Redis instances
├── architect/                    the build plan, phase by phase
├── gothrough.md                  full walkthrough of every flow and file
└── tracking.md                   build progress, with the evidence for each phase
```

---

## Testing

```bash
docker compose up -d
pnpm --filter api test        # 122 tests
pnpm --filter web test        # 13 tests
```

The API tests run against **real Postgres and Redis**, in a separate test database and Redis
index, because the behaviour that matters (constraints, `ON CONFLICT`, sequences, Lua scripts,
time zones) only exists in the real engines.

Some of what's proven:
- 1,000,000 ids → 1,000,000 distinct codes; 5,000 parallel id allocations never collide.
- 50 concurrent requests for an uncached code → exactly 1 database query.
- Redirects keep working with Redis disconnected; the circuit breaker opens and recovers.
- Processing the same click batch twice leaves every count unchanged.
- A reused refresh token revokes the session; logout invalidates an unexpired access token.
- Limits are shared across instances, fail open without Redis, and have no burst at the window
  boundary.
- In the browser: 3 concurrent 401s trigger exactly one silent refresh; the delete is optimistic and
  rolls back on failure; form errors land on the right fields.

The web app was also exercised end to end in a real browser (9 user journeys) and audited for
layout and accessibility at 8 screen widths (320–1920px) in both themes.

---

## How it was built

The project was built in phases, each with a written plan and a checklist that had to be verified
before moving on (see [`architect/`](architect/) and [`tracking.md`](tracking.md)):

| Phase | What it delivered |
|---|---|
| 00 · Monorepo | pnpm + Turborepo workspace, shared packages, Docker services, Prisma setup |
| 01 · API core | Validated config, response envelope, error pipeline, health checks, graceful shutdown |
| 02 · Data model | `urls` table with CHECK constraints, the block-allocated sequence, collision-free codes |
| 03 · Create & redirect | Link creation rules, the 302 redirect, collision retry |
| 04 · Cache | Redis cache-aside, negative caching, single-flight, circuit breaker, invalidation |
| 05 · Rate limiting | Lua sliding-window limits (global, fail-open), scanner blocking |
| 06 · Auth | JWT cookies, sessions, refresh rotation, owner-only link management |
| 07 · Analytics | Click buffer → BullMQ → idempotent batch inserts; time-zone-aware stats |
| 08 · Frontend | Next.js app on a custom design system; audited and browser-tested |

### Key decisions

| Decision | Why |
|---|---|
| Sequence + permutation for codes | "Cannot collide" by construction, instead of "rarely collides" (random) or "same URL, same code" (hashing) |
| Id blocks from Postgres, not Redis | One database call per 1,000 links, and link creation survives a Redis outage |
| Cache hit = one Redis call | No limiter or session lookups on the redirect path |
| 302, not 301 | 301s are cached by browsers forever: no analytics, and no way to disable a link |
| Clicks through a queue | Redirects never wait on a database write |
| Client-generated click ids | Makes the batch insert idempotent, so queue retries can't double-count |
| Sessions in Postgres | Logout and token revocation take effect immediately |
| Soft delete + 30-day purge | Stops anyone claiming a deleted alias and hijacking old links |
| Shared Zod schemas | The form and the API validate identically |
| Frontend-only Next.js | The Express API is the single backend; auth cookies belong to its domain |

### Bugs found by testing, and fixed
- **Analytics crashed for users in India:** Chrome reports the zone as `Asia/Calcutta`, which the
  Postgres image doesn't know. Fixed with an alias table generated from Postgres's own tz data.
- **The main input had no accessible label** (an id was overridden), found by a component test.
- **Logging out redirected to the login page** instead of home (a route-guard race).
- **Pages scrolled sideways on phones:** long URLs widened CSS grid columns (`min-width: auto`).
- **Retried click jobs would double-count** in the original design; fixed with idempotent inserts.

---

## Limitations

- **Single instance.** The API is designed to be stateless, so it *can* run as several instances
  behind a load balancer, but multi-instance deployment, load testing, CI and hosting weren't part
  of this project's scope. No latency benchmarks are claimed.
- **No search, sort or filter** on the links list, and no account-wide analytics yet.
- **Country data** needs a proxy that sets `cf-ipcountry` (e.g. Cloudflare).
- Short codes are **obfuscated, not secret:** fine for public links; private links would need
  cryptographically random codes.
- Metrics are exposed at `/metrics`, but no Prometheus or Grafana setup is included.

---

## Further reading

- [`gothrough.md`](gothrough.md): every flow step by step, every file explained, interview Q&A
- [`architect/`](architect/): the design doc for each phase
- [`architect/design-system.md`](architect/design-system.md): colour tokens, type, components,
  accessibility rules
- [`tracking.md`](tracking.md): what was verified in each phase, and how
