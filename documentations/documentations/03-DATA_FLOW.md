# Data Flow Documentation

> **Scope:** This document describes the data lifecycle as it is implemented in the
> current codebase (Deepslate Dungeons). Where the older docs claimed a feature was
> "planned" or "not implemented", this version states what is actually present in the
> source and notes the few modules that exist but are not yet wired end-to-end.

## Stack at a glance

| Concern            | Technology (current)                                   |
|--------------------|--------------------------------------------------------|
| Cache / queue      | **Upstash Redis** over REST (`@upstash/redis`) — `lib/queue.ts:3` |
| Primary SQL DB     | **Neon PostgreSQL** (via `@neondatabase/serverless` `sql`) — `lib/db.ts:1` |
| Extended documents | **MongoDB** (Mongoose) for characters/maps/items — `lib/GamesInsert.ts:2` |
| Auth               | Clerk JWT validated per-route — `validateJWTMiddleware` |
| Image storage      | Supabase Storage (uploaded via `/api/convertUrl`)      |
| Realtime           | (Convex is referenced in older docs but is **not** created by the current push/insert code paths — see "Corrected claims" below) |

> The legacy `ioredis` client still exists as commented-out code in `lib/queue.ts:8-20`
> but is **not** used. All production Redis I/O goes through the Upstash REST client.

---

## Complete Game Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                         GAME LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Creation (client → API)
├─ Wizard collects game form data
├─ Client calls POST /api/push/pushGames (or POST /api/push type:"game")
├─ Clerk JWT attached; UUID v7 idempotencyKey attached
└─ Body validated with Zod schemas (pushRequestSchema / pushGameDataSchema)

Phase 2: Queue Enqueue (synchronous, fast)
├─ API validates JWT + rate limit + payload schema
├─ Idempotency checked (Redis dedup — see Idempotency section)
├─ Job pushed to Upstash Redis LIST via enqueue()  (rpush)
│   ├─ mongodb "games"  → list key "InsertGamesmongodb"
│   └─ neon    "games"  → list key "InsertGames"
└─ Responds to user immediately (status: queued / synced)

Phase 3: Queue Drain → DB Insert (async, triggered)
├─ Drain is triggered by:
│   ├─ POST /api/push/pushGames calls processGamesQueue() + drainGames() inline
│   ├─ GET /api/games calls maybeTriggerDrain() → self GET /api/drain
│   └─ explicit GET /api/drain?target=games|likes
├─ processGamesQueue()  → MongoDB Game.insertMany()         (lib/GamesInsert.ts:15)
├─ drainGames()         → insertGamesBatch() into Neon PG  (utilities/pull.ts:37)
├─ drainLikes()         → updateGamesLikesBatch() into Neon PG (utilities/pull.ts:20)
└─ (No separate OS-level worker process; draining runs inside the request that triggers it)

Phase 4: Cache Warm-up
├─ warmUpCache() loads top WARMUP_LIMIT (100) games from PG
├─ Writes each as game:{id} (TTL 86400s) and a sorted set game:ids:all
├─ Sets the cache:primed:games flag (TTL 86400s) — lib/cache-warmup.ts:31
└─ See "cacheInitialized flag" below for the module-level gate

Phase 5: Availability (reads)
├─ GET /api/games        → cache-primed / redis mget / PG fallback
├─ GET /api/games/[id]   → game:{id} cache + PG/Mongo merge (route.ts)
└─ GET /api/games/[id]   → hotness cache (route-gamepage.ts, see GamePage section)

Phase 6: Updates
├─ PATCH /api/games/[id]/patches applies JSON-patch ops via applyGamePatches()
├─ Likes mutate counts through the likes pipeline (below)
└─ Cached game:{id} is backfilled on read of a miss; pending likes merged on read
```

---

## API Request/Response Flow

### GET /api/games (List Games) — `app/api/games/route.ts`

Pagination is **offset/limit** (not cursor tokens), driven by `page`/`limit` query params
(`route.ts:64-66`). A module-level `cacheInitialized` flag (`route.ts:10`) gates warm-up.

```
1. validateJWTMiddleware(request)  → 401 if JWT invalid
2. rateLimitMiddleware(request)    → 429 if over limit (per-IP Bottleneck)
3. maybeTriggerDrain()             → self-call GET /api/drain if interval elapsed
   (LIKES_INTERVAL_MS = 10_000, GAMES_INTERVAL_MS = 1_000)  route.ts:32
4. ensureCachePrimed()             → warmUpCache() once, sets cacheInitialized  route.ts:12
5. getCachedGameIds()              → ZRANGE game:ids:all (ordered id list)  route.ts:72
6. If offset < cachedCount:
     ├─ redis.mget("game:<id>") for the page slice        route.ts:84
     ├─ parse + mergePendingLikesBatch(filtered)          route.ts:96
     └─ return { source: "redis" }
7. Else (fallback): skip = offset - cachedCount
     ├─ retry(() => getGamesPaginated(limit, skip))       PG: SELECT … ORDER BY created_at DESC
     ├─ mergePendingLikesBatch(games)                     route.ts:110
     └─ return { source: "postgresql" }
```

**Response shape** (`PaginatedResponse`, `types/api.ts:32`):
```json
{
  "success": true,
  "data": [ { "id": "uuid", "name": "...", "likes_count": 100, "characters": [], "maps": [], "items": [] } ],
  "pagination": { "page": 1, "limit": 10, "total": 50, "totalPages": 5, "hasMore": true, "source": "redis" }
}
```

> **Cache semantics:** `game:ids:all` is a *sorted set* used as the source-of-truth id
> list for the first `cachedCount` entries. On a warm-up the score is the insertion
> index (`cache-warmup.ts:60`); on a single-game backfill the score is `Date.now()`
> (`cache-warmup.ts:151`), so a newly created game floats to the top.

### GET /api/games/[id] (Game detail — active route) — `app/api/games/[id]/route.ts`

This is the route file Next.js actually serves (only `route.ts` is a valid route
filename; `route-gamepage.ts` is a sibling that is **not** auto-exposed — see GamePage section).

```
1. validateJWTMiddleware
2. getGameFromCache(id)   → redis.get("game:<id>")  (lib/cache-warmup.ts:88)
   └─ if HIT: mergePendingLikes(cached) → 200, header X-Cache: HIT   route.ts:25-29
3. On MISS: Promise.all([
     retry(() => getGameById(id)),                         ← Neon PG
     retry(() => connectDB().then(() => Game.findOne({id}).lean()))  ← MongoDB
   ])                                                        route.ts:32-35
4. if !pgGame → 404 "Game not found"
5. fullGame = { ...pgGame, characters, maps, items, status }   route.ts:41-47
6. mergePendingLikes(fullGame)  (add pending like delta)
7. setGameInCache(id, merged)   ← best-effort backfill (X-Cache: MISS)  route.ts:51
```

### GamePage detail flow — `app/api/games/[id]/route-gamepage.ts` (IMPLEMENTED)

The "planned" GamePage hotness cache is **implemented** in `utilities/hotnessCache.ts`
and consumed by `route-gamepage.ts`. It is a two-tier, pako-gzip-compressed cache:

- `getCachedGameData(id)` → load `cache:views:array`, `cache:data:array` (Map),
  `cache:hashmap:map` and binary-search the hashmap for the uuid (`route-gamepage.ts:30`).
  On HIT it calls `cacheHit()` to bump the view count and re-position the entry
  (descending by views) via `binarySearchViews()` (`hotnessCache.ts:86`).
- On MISS it fetches PG + MongoDB (`route-gamepage.ts:44`), then calls `cacheMiss()`
  which increments the `game:hotness:<uuid>` counter and **promotes** the game into the
  sorted cache once `PROMOTION_THRESHOLD` (5) is reached (`hotnessCache.ts:228-304`).
  Max `MAX_CACHE_ENTRIES` = 1000; eviction pops the lowest-view entry.
- All Redis ops use `redisWithExponentialRetry()` (exponential backoff, 3 tries, 100ms
  base) from `utilities/hotnessCacheWithRetry.ts:26`.

> **Wiring caveat (documented for accuracy):** `route-gamepage.ts` is not the file
> Next.js serves for `GET /api/games/[id]` — `route.ts` is. The batch-fetch pipeline
> (`utilities/gameFetchPipeline.ts` + `utilities/clientUtilities/gameFetch.ts`) is also
> **implemented** but the API routes it calls (`/api/games/batch-queue`,
> `/api/games/batch-result`) do **not** exist yet, so the Redis-queue batch path is not
> end-to-end wired. The active `[id]` read path uses the `cache-warmup` cache + direct
> PG/Mongo fetch. Treat the hotness cache as implemented-but-not-yet-routed.

### POST /api/push (Generic push: game or like) — `app/api/push/route.ts`

This is the unified push endpoint used by the likes store and also accepts `type:"game"`.

```
1. validateJWTMiddleware + rateLimitMiddleware
2. pushRequestSchema.safeParse(body)   → 400 on invalid
3. withIdempotency(idempotencyKey, async () => {
     if type === "game":
        ├─ pushGameDataSchema.safeParse(data)
        └─ retry(() => enqueue("neon","games",gameData))   route.ts:67
     if type === "like":
        ├─ retry(() => redis.incrby(`likes:${id}`, likesDelta))   route.ts:86  ⭐ immediate count
        └─ retry(() => enqueue("neon","likes",likeData))           route.ts:89
   })
4. return { ...result, idempotencyKey, cached }   (cached=true means dedup hit)
```

### POST /api/push/pushGames (Game create, double-write) — `app/api/push/pushGames/route.ts`

A second, more explicit creation path that writes to MongoDB *and* Neon in one request:

```
1. validateJWTMiddleware
2. require idempotencyKey (400 if missing)
3. withIdempotency(idempotencyKey, async () => {
     await retry(() => enqueue("mongodb","games",dbGameData))   → list "InsertGamesmongodb"
     await Promise.all([
       retry(() => processGamesQueue()),   ← drains mongodb queue → Game.insertMany()
       retry(() => drainGames()),          ← drains neon queue   → insertGamesBatch()
     ])
   })
4. return { success, message, data:{mongo,pg}, idempotencyKey, cached }
```

> Note: `processGamesQueue()` only reads the **mongodb** queue (`lib/GamesInsert.ts:10`)
> and writes to **MongoDB**. The Neon copy is produced by `drainGames()` reading the
> **neon** games queue. So a game must be enqueued to *both* providers to land in both
> stores — `pushGames` does the neon drain, but the neon *enqueue* for games happens via
> `/api/push type:"game"` or some other producer.

### GET /api/drain (Trigger queue drain) — `app/api/drain/route.ts`

Throttled drain worker entrypoint (no separate process — runs in-request):

```
validateJWTMiddleware
target = ?target=  (likes|games) ; force = ?force=true
shouldDrainLikes  = force || target==="likes" || now-lastLikesDrain >= 10_000
shouldDrainGames  = force || target==="games" || now-lastGamesDrain >= 1_000
→ drainLikes()  (utilities/pull.ts:8)   → updateGamesLikesBatch() + delete likes:<id> keys
→ drainGames()  (utilities/pull.ts:31)  → insertGamesBatch()
returns { skipped, nextLikesDrainIn, nextGamesDrainIn, likes?, games? }
```

### POST /api/convertUrl (Image upload) — `app/api/convertUrl/*`

Converts inbound image to webp and uploads to Supabase Storage using a Clerk-issued
Supabase JWT (`auth().getToken({ template: 'supabase' })`). Returns the public URL.
Idempotency for repeats is best-effort via the same `withIdempotency` pattern.

### AI server proxying (IMPLEMENTED)

Two server-only relays keep the browser away from the AI server (FastAPI) and its
Upstash Search creds:

- **`app/api/ai-server/[...path]/route.ts`** — generic relay. `GET/POST/PUT/DELETE
  /api/ai-server/<path>` forwards to `AI_SERVER_URL` (default `http://127.0.0.1:8000`),
  preserving query string and JSON body; non-2xx becomes `502` (`route.ts:18-26`).
- **`app/api/games/[id]/memory/route.ts`** — narrow relay to `/memory/*`:
  `GET  → /memory/export/<id>`, `POST → /memory/restore` (expects `{chunks:[]}`),
  `DELETE → /memory/clear?namespace=<id>` (`memory/route.ts:9-32`).

---

## Likes Pipeline (IMPLEMENTED)

The likes store is fully implemented client-side and backed by the push + drain flow.

1. **Client toggle** — `stores/likes-store.ts` (Zustand + `persist` to localStorage).
   `toggleLike()` does optimistic add/remove, marks the game `pendingLikes`, and POSTs
   to `/api/push` with `type:"like"` and a fresh UUID v7 idempotencyKey
   (`likes-store.ts:96-104`). On success `_apply()` clears pending; on failure `_revert()`
   restores the previous liked state + count and shows an error toast.
2. **Server** — `/api/push type:"like"` immediately `INCRBY likes:<id> <delta>` in Redis
   (`push/route.ts:86`) **and** enqueues `{id, likesDelta}` to the neon `likes` list
   (`push/route.ts:89`). The Redis `likes:<id>` counter is the authoritative *real-time*
   count between drains.
3. **Drain** — `drainLikes()` (`utilities/pull.ts:8`) aggregates deltas per id, calls
   `updateGamesLikesBatch()` (UNNEST upsert into `games.likes_count`, `lib/db.ts:79`),
   then deletes the `likes:<id>` pending keys.
4. **Read merge** — list and detail reads call `mergePendingLikes(Batch)()`
   (`lib/cache-warmup.ts:102,117`), which adds any remaining `likes:<id>` delta on top of
   the persisted count, so the UI always shows the live total even before a drain runs.

---

## Inter-Service Communication

```
Frontend → API Routes
  HTTP REST, Clerk JWT in Authorization header, JSON in/out, status codes.
  tryApiRoute() wraps handlers; rateLimitMiddleware() guards per-IP (Bottleneck).

API Routes → Upstash Redis (REST)
  enqueue/drain use RPUSH / RENAME+LRANGE (atomic drain) / GET / SET / MGET / ZRANGE / ZADD.
  lib/queue.ts exports the shared client; utilities/queue.ts wraps enqueue/drain.

API Routes → Neon PostgreSQL
  @neondatabase/serverless `sql` tagged templates in lib/db.ts.
  All queries wrapped in retry() (see below).

API Routes → MongoDB
  Mongoose models (Game) via connectDB(); used for nested characters/maps/items + status.

API Routes → Supabase
  HTTPS REST multipart for image uploads (convertUrl). Authenticated with Clerk→Supabase JWT.

Next.js → AI Server (FastAPI)
  Server-only relay /api/ai-server/[...path] and /api/games/[id]/memory. Browser never
  talks to the AI server directly.
```

---

## Idempotency (UUID v7 + Redis dedup)

Implemented in `utilities/idempotency.ts` and used by every mutating endpoint.

- Keys are **UUID v7** (`generateIdempotencyKey()`, `v7()` from `uuid`) — `idempotency.ts:8`.
- `withIdempotency(key, fn)`:
  - `getCachedResult(key)` → if `idempotency:<key>` exists in Redis, returns the cached
    result with `cached:true` and **does not re-run `fn`** (`idempotency.ts:45-49`).
  - Otherwise runs `fn()` and stores the result under `idempotency:<key>` with
    `ex: IDEMPOTENCY_TTL_SECONDS` (`idempotency.ts:57-58`).
- `IDEMPOTENCY_TTL_SECONDS = 300` (5 minutes) — `types/api.ts:72`. Replays within the TTL
  get the identical response (same data + status), preventing duplicate game inserts or
  double likes.
- `withIdempotencySafe()` is the error-capturing variant; `clearIdempotencyKey()` and
  `getIdempotencyKeyInfo()` support manual cleanup/inspection.

> The client (likes store, wizard) is responsible for generating and sending the key.
> If a key is missing, `/api/push/pushGames` returns `400 Missing idempotencyKey`.

---

## `cacheInitialized` flag semantics

- Declared as a **module-scoped** `let cacheInitialized = false` in `app/api/games/route.ts:10`.
  Because Next.js may reuse module instances across requests in a warm server, this flag
  effectively persists for the lifetime of the server process (per instance), not per request.
- `ensureCachePrimed()`:
  - If already `true`, returns immediately (skips warm-up) — `route.ts:23`.
  - If `false`, calls `retry(() => warmUpCache(), 2, 500)` and **only then** assigns the
    result to `cacheInitialized` (`route.ts:15-19`). So the flag is set to `true` **only
    after a successful warm-up attempt**; if warm-up throws/returns `false`, the flag
    stays `false` and the next request retries warm-up.
- `warmUpCache()` itself short-circuits if the Redis `cache:primed:games` flag is already
  `"true"` (`cache-warmup.ts:33-37`), so repeated warm-ups are cheap and idempotent.
- The flag gates whether the list endpoint trusts the `game:ids:all` sorted set for the
  first page(s). If warm-up never succeeds, every list request falls through to PostgreSQL
  (still correct, just slower).

---

## Retry wrapper on DB / Redis ops

`lib/retry.ts` (`retry(fn, maxTries=3, delayMs=500, exponentialBackoff=false)`):

- Runs `fn()`; on throw, waits `delayMs` (flat) or `delayMs * 2^(attempt-1)` (exponential),
  then retries up to `maxTries`. After exhausting attempts it throws the last error
  (`retry.ts:9-22`).
- Used everywhere a DB/Redis call can transiently fail:
  - `lib/db.ts` wraps every `sql` query and batch insert (2–3 tries).
  - `app/api/games/route.ts` and `app/api/games/[id]/route.ts` wrap cache + DB reads.
  - `app/api/push/*` wrap `enqueue` (3 tries).
  - Hotness cache uses the dedicated `redisWithExponentialRetry()` (always exponential,
    3 tries, 100ms base) — `utilities/hotnessCacheWithRetry.ts:26`.
- Errors from DB ops are classified via `classifyError()` (in `utilities/errorHandler.ts`)
  before logging, giving each failure a stable context label for observability.

---

## Error Flow

```
Validation error (Zod / missing idempotencyKey)
  → 400 with { error, details: issues }      (e.g. push/route.ts:37)

JWT error
  → validateJWTMiddleware returns 401         (handled in every route)

Rate limit
  → rateLimitMiddleware throws → 429          (push/route.ts:25, games/route.ts:57)

Idempotency replay
  → returns the cached prior response with cached:true (no side effects)

Database / queue error
  → retry() attempts N times; if still failing, the enclosing tryApiRoute logs a
    classified error and returns a 5xx. A push that fails to enqueue is NOT acked,
    so the client can safely retry with the SAME idempotencyKey (dedup protects us).

Cache error (Redis)
  → caught and logged; reads fall back to PostgreSQL (authoritative). Writes are
    best-effort and never block the response.

AI server relay error
  → non-2xx from AI server → 502 with the upstream body text
```

---

## State Transitions

### Game state
```
ENQUEUED (Redis list)            ← POST /api/push or /pushGames
   ↓ processGamesQueue / drainGames
STORED (Mongo + Neon)            ← insertMany + insertGamesBatch
   ↓ warmUpCache / setGameInCache
CACHED (game:<id>, game:ids:all) ← served from Redis on read
   ↓ mergePendingLikes on read
AVAILABLE → UPDATED (patches/likes mutate persisted + pending counts)
```

### Request state (read)
```
NEW → JWT_VALIDATED → RATE_CHECKED → CACHE_CHECK
   → (HIT) REDIS_SERVED
   → (MISS) DB_FETCH (PG + Mongo) → CACHE_BACKFILL → DB_SERVED
   → POST-PROCESS: mergePendingLikes → RESPONSE_SENT
```

---

## Corrected claims vs. older docs

- **Convex is not created by the push/insert path.** The current `processGamesQueue`,
  `drainGames`, and `/api/push` code do **not** write Convex records. No `convex/` write
  exists in the game creation flow. (Real-time Convex may exist elsewhere, but it is not
  part of the documented game lifecycle.)
- **The queue is drained in-request, not by a standalone worker.** `drain` is triggered
  by `/api/drain` (self-called from list reads and explicitly from `pushGames`), not by a
  separate continuously-running process.
- **Redis is Upstash REST, not ioredis TCP.** `lib/queue.ts` uses `@upstash/redis`.
- **The GamePage hotness cache, the batch-fetch pipeline, and the likes store are
  IMPLEMENTED** (see sections above). The hotness cache is consumed by
  `route-gamepage.ts`; the batch-fetch client (`gameFetch.ts`) is implemented but its
  backing API routes are not yet present.
- **Pagination is offset/limit, not cursor.** `GET /api/games` uses `page`/`limit` and a
  `source` field (`"redis"` | `"postgresql"`) rather than opaque cursors.
