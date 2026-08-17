# Architecture Overview — Deepslate Dungeons

> Dark-fantasy RPG game-creation platform. This document reflects the **current** codebase
> (verified against `app/`, `lib/`, `db/`, `convex/`, `utilities/`, `stores/`, `types/`,
> `package.json`, and `next.config.ts`). It corrects stale claims about unimplemented
> screens (Game detail, Play) and the AI server integration.

## Tech Stack (current versions)

| Layer | Technology | Source |
|-------|-----------|--------|
| Framework | Next.js `16.2.4` (App Router) | `package.json:31` |
| UI | React `19.2.4`, Radix UI `^1.4.3`, shadcn `^4.7.0` | `package.json:38-41` |
| Styling | Tailwind CSS `^4.2.4` + CSS Modules (hybrid) | `package.json:44` |
| Auth | Clerk `^7.4.1` (JWT templates: `supabase`) | `package.json:12` |
| Realtime | Convex `^1.39.1` | `package.json:24` |
| Primary DB | Neon PostgreSQL via `@neondatabase/serverless ^1.1.0` | `package.json:13` |
| Extended DB | MongoDB via `mongoose ^9.6.2` | `package.json:30` |
| Cache + Queue | Upstash Redis via `@upstash/redis ^1.38.0` | `package.json:17` |
| Image Storage | Supabase Storage `@supabase/supabase-js ^2.105.4` | `package.json:15` |
| AI Runtime | External FastAPI "AI server" (relayed) | `lib/ai-server-client.ts:23` |

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 16 App Router)                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ React 19 Components (Server + Client)                              │  │
│  │  • Routes: /, /game/[uuid], /play/[sid], /adventures               │  │
│  │  • Styling: CSS Modules (structure) + Tailwind v4 (cn())           │  │
│  │  • Stores: likes-store (zustand, persisted)                       │  │
│  │  • PostHog analytics (rewrites in next.config.ts)                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────────────┬───────────────┘
                │ (REST via Next.js API routes)             │ (Convex WS)
        ┌───────▼────────┐                          ┌───────▼──────────────┐
        │  Auth Layer    │                          │  Convex Provider     │
        │  Clerk + JWT   │                          │  (realtime sync)     │
        │  Token Validate│                          │  app/convex-provider │
        └───────┬────────┘                          └──────────┬───────────┘
                │                                            │
   ┌────────────▼─────────────┐                 ┌────────────▼───────────┐
   │      API Routes           │                 │  Convex Backend        │
   │  /api/push, /api/games,   │                 │  games/characters/     │
   │  /api/convertUrl,         │                 │  maps/items/staff      │
   │  /api/ai-server/[...path] │                 └────────────────────────┘
   └───────┬───────────────────┘
           │ enqueue / drain (Redis lists)
   ┌───────▼───────────┐
   │  Worker / Pull     │  (utilities/pull.ts, lib/GamesInsert.ts)
   └───┬───────────┬────┘
       │           │
┌──────▼───────┐ ┌─▼──────────────┐ ┌───────────────┐ ┌──────────────┐
│ Upstash Redis│ │ Neon Postgres   │ │ MongoDB       │ │ Supabase     │
│ Cache+Queue  │ │ (catalog:games) │ │ (extended)    │ │ Storage      │
│ hotness+likes│ │                 │ │               │ │ (images webp)│
└──────────────┘ └────────────────┘ └───────────────┘ └──────────────┘
           │
   ┌───────▼───────────┐
   │  AI Server (relay)│  FastAPI @ AI_SERVER_URL (default 127.0.0.1:8000)
   │  queue/state/mem  │  app/api/ai-server/[...path]/route.ts
   └───────────────────┘
```

## Component Overview

### Frontend Layer
- **Framework:** Next.js 16 App Router; React 19.2.4.
- **UI primitives:** Radix UI + shadcn; `ui/primitives/` (button, card, input…).
- **Styling (hybrid):** CSS Modules for layout/structure + Tailwind v4 utilities,
  combined through `cn()` from `lib/utils.ts` (`cn(styles.x, "tailwind-class")`).
  Fonts: Cormorant Garamond (`--font-display`) + DM Sans (`--font-sans`) (`app/layout.tsx:9-20`).
- **State:** `stores/likes-store.ts` — zustand store with `persist` middleware for
  optimistic likes and a pending-likes set.
- **Analytics:** PostHog via `/ingest/*` rewrites (`next.config.ts:17-32`).

### Authentication Layer
- **Primary:** Clerk (`@clerk/nextjs ^7.4.1`), wrapped around the app in
  `app/layout.tsx:29` and integrated with Convex via `ConvexProviderWithClerk`
  (`app/convex-client-provider.tsx:14`).
- **JWT templates:** a `supabase` template is minted for authenticated Supabase
  Storage access (`hooks/useAuth.ts:36`, `lib/auth.ts:16`).
- **API protection:** `validateJWTMiddleware` + `rateLimitMiddleware` + zod
  validation on every write route (see `app/api/push/pushGames/route.ts`).
- **Convex auth:** `requireAuth` / `requireStaff` helpers with a `staff` table and
  degree-based authorization (`convex/authHelpers.ts`).

### API Layer
- **Runtime:** Next.js Route Handlers (App Router).
- **Write entry:** `POST /api/push` with `idempotencyKey`, `type` (`game` | `like`),
  and `data` (`app/api/push/pushGames/route.ts`).
- **Idempotency:** UUID v7 keys + Redis dedup via `withIdempotency`
  (`stores/likes-store.ts:100` uses `uuidv7()`; queue keys use `uuidv7()` in
  `utilities/queue.ts:24`).
- **AI relay:** `app/api/ai-server/[...path]/route.ts` forwards GET/POST/PUT/DELETE
  to the external FastAPI AI server (no CORS in browser).

### Cache + Queue Layer (Upstash Redis)
- **Client:** `@upstash/redis` (`lib/queue.ts:3`). The legacy `ioredis` client is
  commented out and reserved for future use (`lib/queue.ts:8-20`).
- **Queue primitive:** Redis lists with `RPUSH`/`RENAME`+`LRANGE`+`DEL` snapshot
  drains (`utilities/queue.ts`; `types/operations.ts` defines providers/queues:
  `neon`/`mongodb` × `games`/`likes`).
- **Caches:** per-game objects (`game:{id}`), a sorted `game:ids:all` set, a
  `cache:primed:games` flag, the **hotness cache**, and pending-likes keys
  (`likes:{id}`).

### Database Layer

#### PostgreSQL — Neon (Primary Catalog)
- **Driver:** `@neondatabase/serverless` (`db/client.ts:1`).
- **Schema:** single `games` table (`db/schema.sql`): `id UUID PK`, `name`,
  `likes_count`, `description`, `image`, `tags TEXT[]`, `created_at`, `updated_at`,
  with a GIN index on `tags` and an index on `name`.
- **Access:** all queries wrapped in the `retry()` pattern from `lib/retry.ts`
  (e.g. `lib/db.ts:9`, `:104`, `:121`, `:140`).

#### MongoDB (Extended Game Data)
- **Driver:** `mongoose ^9.6.2` (`lib/GamesInsert.ts:3` uses `Game.insertMany`).
- **Responsibility:** nested characters / maps / items / status per game
  (`Game` model imported from `@/models/games/mongodb/schema`).

#### Convex (Realtime Scaffold)
- **Schema:** `games`, `characters`, `maps`, `items`, `staff` tables
  (`convex/schema.ts`).
- **APIs:** `list` (paginated), `get`, `create`, `update`, `remove` (`convex/games.ts`),
  with ownership checks and cascade deletes. Auth via Clerk identity.
- **Integration:** provider in `app/convex-client-provider.tsx`; staff authorization
  helpers in `convex/authHelpers.ts`.

### Storage Layer (Supabase)
- **Purpose:** image upload/retrieval.
- **Flow:** buffer → `convertToWebp` (sharp, **quality 80**) →
  `client.storage.from(bucket).upload(..., { contentType: "image/webp" })` with
  retry (`lib/storage.ts`, `utilities/imagesUtils.ts:7`).
- **Config:** bucket from `NEXT_PUBLIC_SUPABASE_BUCKET_NAME` (default `deepslate-rpg`);
  Supabase host whitelisted in `next.config.ts:9`; `qualities: [75, 85]` for
  `next/image` (`components/shared/FittedImage.tsx:25`).

### AI Server Integration (Implemented)
- **Runtime:** external FastAPI service at `AI_SERVER_URL` (default `http://127.0.0.1:8000`).
- **Client lib:** `lib/ai-server-client.ts` (queue, game state, memory, counter, lock, output).
- **Browser path:** all calls go through Next.js relay `/api/ai-server/[...path]`
  (`app/api/ai-server/[...path]/route.ts`) and helpers in `lib/playClient.ts`
  (queue push, output, state, counter, memory export/restore).

## DB Responsibilities

| Store | Responsibility | Key Code |
|-------|----------------|----------|
| Neon PostgreSQL | Canonical game catalog (id, name, image, tags, likes_count, timestamps); sorting/filtering | `db/schema.sql`, `lib/db.ts` |
| MongoDB | Extended, nested game content: characters, maps, items, status | `lib/GamesInsert.ts`, `models/games/mongodb` |
| Upstash Redis | App cache (game objects, id set, primed flag), hotness cache, pending likes, job queues | `lib/queue.ts`, `lib/cache-warmup.ts`, `utilities/hotnessCache.ts` |
| Supabase Storage | Game/component image binaries (WebP) | `lib/storage.ts` |
| Convex | Realtime games/characters/maps/items + staff auth | `convex/schema.ts`, `convex/games.ts` |
| AI Server | Per-game AI state, memory, queue, output for the Play experience | `lib/ai-server-client.ts`, `lib/playClient.ts` |

## Data Flow Patterns

### Game Creation Flow
```
1. User submits form (Frontend, /adventures)
   → images uploaded to Supabase (WebP quality 80) via /api/convertUrl
   → POST /api/push { idempotencyKey: uuidv7(), type: "game", data }
2. API route: validate JWT → rate limit → zod validate → withIdempotency(dedup)
3. enqueue("neon"|"mongodb", "games", payload)  (utilities/queue.ts)
4. Worker drains queue:
   - Neon: insertGamesBatch / insertGame (lib/db.ts) wrapped in retry()
   - MongoDB: Game.insertMany (lib/GamesInsert.ts)
5. Cache warm-up primes game:{id} + game:ids:all on next read
6. Convex: game may be mirrored/managed via convex/games.ts mutations
7. Response returned (idempotency-cached on repeat)
```

### Game Retrieval Flow
```
1. Server route app/game/[uuid]/page.tsx (getGameById → Neon, lib/db.ts:139)
   → generateMetadata for SEO/OG
2. Client GameDetailClient hydrates via useGameCache / useGamePreload
3. Hotness cache consulted: cacheHit (increment views) or cacheMiss
   (promote to sorted cache after PROMOTION_THRESHOLD=5 accesses)
4. Pending likes merged from likes:{id} (lib/cache-warmup.ts:102)
5. Convex realtime subscriptions keep characters/maps/items fresh
```

### Play Flow (Implemented)
```
1. app/play/[sid]/page.tsx → <PlayGate sid>
2. Browser calls /api/ai-server/* via lib/playClient.ts
   (queuePush, outputGet, stateSetField, counterIncr, memoryExport/Restore)
3. Relay forwards to FastAPI AI server
```

### Like Flow
```
1. likes-store.toggleLike → optimistic update + POST /api/push { type:"like" }
2. enqueue("neon","likes",{id,likesDelta}) → worker drainLikes → updateGamesLikesBatch
3. pending likes tracked in likes:{id}; merged on read
```

## Caching Strategy

### Layers
- **L1 — Redis object cache:** `game:{id}` (TTL 86400s), sorted `game:ids:all`
  (ZSET, `lib/cache-warmup.ts`).
- **Primed flag:** `cache:primed:games` is set to `"true"` only after a successful
  warm-up (`warmUpCache` in `lib/cache-warmup.ts:24-29`, `:65`). Warm-up is skipped
  if already primed.
- **Hotness cache (`utilities/hotnessCache.ts`):** two-tier — a *hotness map*
  (`game:hotness:{uuid}`) tracking access frequency, and a *sorted cache* of the top
  `MAX_CACHE_ENTRIES=1000` viewed games stored as parallel arrays (views + data) for
  binary-search promotion. Values are gzip-compressed via `pako` (base64).
- **L2 — DB/Convex:** Neon connection pooling, MongoDB indexes, Convex automatic
  caching.

### Invalidation
- Create/update: set/refresh `game:{id}`, touch `game:ids:all` (`setGameInCache`,
  `lib/cache-warmup.ts:143`).
- Likes: `likes:{id}` pending delta merged on read; cleared after batch apply.
- Hotness: entries evicted (lowest views) when full; hotness key deleted on promotion.

## Conventions (enforced in code)

- **Hybrid styling:** CSS Modules (structure) + Tailwind v4 utilities via
  `cn()` from `lib/utils.ts`. Never pure CSS modules alone, never pure Tailwind alone.
- **DB retry pattern:** every Neon query is wrapped
  `await retry(async () => { await sql`...` }, tries, delay)` (`lib/retry.ts`,
  used throughout `lib/db.ts`).
- **Idempotency:** UUID v7 keys + Redis dedup (`withIdempotency`, `uuidv7()` in
  `stores/likes-store.ts:3`, `utilities/queue.ts:4`).
- **Supabase images:** converted to WebP with `sharp` (quality **80**) before upload,
  with retry on both upload and public-URL resolution (`lib/storage.ts`).
- **Polyglot persistence:** Neon (catalog) + MongoDB (nested) + Upstash Redis
  (cache+queue) + Supabase Storage (images) + Convex (realtime scaffold) + AI server
  (play runtime).

## Connection Matrix

| Component A | Component B | Protocol | Purpose | Auth |
|-------------|-------------|----------|---------|------|
| Frontend | API Routes | HTTP REST | API calls | Clerk JWT |
| API Routes | Upstash Redis | HTTPS REST | Cache/Queue | REST token |
| API Routes | Neon Postgres | HTTPS | Read/Write catalog | Neon conn string |
| API Routes | MongoDB | TCP | Read/Write details | Mongoose URI |
| API Routes | Supabase | HTTPS | Image storage | Clerk→Supabase JWT |
| Frontend | Convex | WebSocket | Realtime updates | Clerk identity |
| API Routes | AI Server | HTTP (relay) | Play runtime | none (server-side) |
| Worker | Redis | HTTPS REST | Job processing | REST token |
| Worker | Neon / MongoDB | HTTPS / TCP | Batch inserts | Conn strings |

## Scalability Notes

- **Frontend/API:** serverless auto-scaling on Vercel (Next.js 16).
- **PostgreSQL:** Neon serverless compute + autoscaling; all access retry-wrapped.
- **MongoDB:** Atlas; batch `insertMany` for queue drains.
- **Redis:** Upstash serverless (per-request REST); hotness cache caps at 1000
  entries and evicts lowest-viewed to bound memory.
- **Realtime:** Convex multi-region; auth-gated writes with ownership checks.
- **AI server:** external FastAPI relayed through Next.js, so the browser never
  touches it directly (no CORS surface).
- **Resilience:** `retry()` with optional exponential backoff (`lib/retry.ts`),
  `redisWithExponentialRetry` for hot paths (`utilities/hotnessCacheWithRetry.ts`).

## Monitoring Points
1. API response times per route (PostHog + `console` logs).
2. Redis cache hit/miss + hotness cache stats (`getCacheStats`).
3. Queue lengths (`queueSize`) for games/likes.
4. DB query latency (retry-wrapped, classified errors via `utilities/errorHandler`).
5. Error rates (4xx/5xx) and AI-server relay 502s.
