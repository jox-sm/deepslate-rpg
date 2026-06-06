
1. **Likes System Integration:** We need to organize and link the likes system inside `app/api/games/[id]` so that it processes actions through **Redis Queues**.
2. **Centralizing Redis Queues:** We are going to eliminate all individual Redis queue setups. The code has blown up significantly because we keep creating a new queue for every single component. Instead, we'll turn it into a **generic utility** that takes parameters like the query name or queue name. This will give us a **centralized logic** and make the code much more readable.
3. **State Synchronization (Myers' Algorithm vs. Event-Driven):** We need to analyze and look into using **Myers' algorithm** to compare JSON data, extract mutations, and merge them. I checked **Upstash**, and we can actually modify JSON objects directly without uploading the entire file. So, we will replace GraphQL with Myers' algorithm just to extract the specific parts that changed.
   For example, if a character is added, we can handle this in two ways: **Event-Driven** or **Myers' Diff**.
   Honestly, **Myers' Diff** is a far better choice because the processing happens entirely on the **client-side (user's device)** before hitting the server. On the other hand, the **Event-Driven** approach relies fully on the server, which definitely introduces higher latency and consumes server processing power.
   Consequently, if 10,000 concurrent users are online sending messages while interacting with the AI, going Event-Driven would be reckless since we are on the **Vercel Free Tier**. We would be heavily restricted by the number of operations we can run. Plus, doing it my way brings user latency down to near-zero.
   Alternatively, I could just maintain a local variable on the client to track mutations and ship them instantly instead of running Myers' algorithm altogether. This seems like a better fix at first glance, but here is why **Redis** is vastly more efficient: the total lines of code won't even exceed 500 lines anyway, yet a user can continuously modify the exact same item (whether it's a character, a map, or anything else).
   If we adopt a naive architecture that simply tracks changes as events and pushes them, it will be a complete disaster because it doesn't intercept updates and deletions reliably. That's why the **Myers' Diff + POST + Upstash Operations** stack is a much better choice. It flawlessly captures exactly what was deleted, what was updated, and what was added."

---

## Execution Plan

## Detailed Steps (for agent executing this plan)

### How to navigate the codebase
Use `graphify-out/graph.json` + `graphify-out/graph.html` to find relevant files. Key communities:
- Community 71: Neon DB queries (`lib/db.ts`)
- Community 75: Games queue worker (`lib/GamesInsert.ts`, `utilities/insertGame.ts`)
- Community 104: Likes queue (`utilities/db.ts`, `utilities/pull.ts`)
- Community 47: Redis caching (`lib/cache-warmup.ts`)
- Community 120: Data model types (`types/gamedata.ts`)
- Community 7: Zod validation schemas (`types/validation.ts`)
- Community 48: Idempotency types (`types/api.ts`, `utilities/idempotency.ts`)

Read only the files listed in each step. Don't read the whole project.

### Step 1: Centralize Queue Utilities (Issue #90)

Create a single `utilities/queue.ts` that replaces both `utilities/db.ts` (queue parts) and `utilities/insertGame.ts`.

**Files to read first:**
- `utilities/db.ts` (95 lines — queue functions + load key)
- `utilities/insertGame.ts` (60 lines — MongoDB queue functions)
- `lib/queue.ts` (12 lines — Redis client singleton, keep this file)
- `types/db.ts` (6 lines — `Likes` type)
- `types/validation.ts` (160 lines — `pushRequestSchema`, `likesSchema`, `pushGameDataSchema`)
- `types/api.ts` (72 lines — `IdempotentRequest`, etc.)
- `lib/db.ts` (150 lines — `insertGamesBatch()`, `updateGamesLikesBatch()`)

**What to create:**
- `types/operations.ts`: Provider type + operations registry
  - `OperationProvider = "neon" | "mongodb"`
  - A `queueConfig` object that maps `(provider, queueName)` to Redis key + drain handler

- `utilities/queue.ts`: The unified utility
  - `enqueue(provider, queueName, payload)` → resolve Redis key, `RPUSH`, return
  - `drain(provider, queueName)` → `RENAME` → `LRANGE` → `DEL` temp → return parsed items
  - NO `load` key. NO `InsertGamesmongodb:active` pattern. Keep it simple: push and drain are separate operations.
  - Use the existing `redis` client from `@/lib/queue`

**Redis key mapping (hardcoded):**
```
("neon", "games") → "InsertGames"
("neon", "likes") → "InsertLikes"
("mongodb", "games") → "InsertGamesmongodb"
```

**What to modify:**
- `app/api/push/route.ts`: Replace `pushGameToQueue` and `PushLikesToQueue` from `@/utilities/db` with `enqueue` from `@/utilities/queue`
- `app/api/push/pushGames/route.ts`: Replace `pushGameToQueue` from `@/utilities/insertGame` with `enqueue` from `@/utilities/queue`. Remove `validateQueue`, `setToWorking`, `setToIdle`, `validateQueueWorking` imports — they're going away.
- `utilities/pull.ts`: Replace `getGamesQueue` and `getLikesQueue` from `@/utilities/db` with `drain` from `@/utilities/queue`
- `lib/GamesInsert.ts`: Replace `getGamesQueue` from `@/utilities/insertGame` with `drain` from `@/utilities/queue`

**What to clean up:**
- Remove from `utilities/db.ts`: `pushGameToQueue`, `PushLikesToQueue`, `getGamesQueue`, `getLikesQueue`, `pushToQueue`, `validateQueue` (the `load` key functions). If nothing remains in the file, delete it.
- Delete `utilities/insertGame.ts` entirely (everything is now in `utilities/queue.ts`)

**Wait for user to:**
- Add `@upstash/redis` package + env vars (they said they'll do this)

---

### Step 2: Refactor Likes — Instant Write + Async Drain (Issue #89)

**Depends on:** Step 1 (needs the new `enqueue` utility)

**Files to read first:**
- `app/api/push/route.ts` (75 lines — the POST handler)
- `utilities/pull.ts` (28 lines — current drain, will be modified)
- `ui/notifications/index.ts` — exports `toast`, `successToast`, `errorToast`
- `exceptions/notifications/success.tsx` — `SuccessNotification` component pattern
- `utilities/errorHandler.ts` — `showToastFor` pattern

**Changes:**

1. **`POST /api/push` handler for `type: 'like'`:**
   - Remove the inline `processPull()` call
   - Add direct Upstash Redis write: `INCRBY likes:{gameId} {delta}` using the Upstash Redis client (user will add this)
   - Keep: `enqueue("neon", "likes", data)` for Neon persistence
   - Return immediately after the two writes succeed
   - On success: return 200 immediately (don't wait for drain)
   - On failure: let the error handler show the toast (existing `tryApiRoute` wrapper)

2. **Drain mechanism (lazy drain on read — Option B):**
   - Likes queue drains every **10 seconds** → triggered by reads (GET /api/games)
   - Games queue drains every **1 second** → separate trigger
   - Create `app/api/drain/route.ts` with:
     - `GET` handler that checks `"InsertLikes"` and `"InsertGames"` queue sizes
     - If likes have items → drain + `updateGamesLikesBatch()` (Neon)
     - If games have items → drain + `insertGamesBatch()` (Neon)
   - Modify `app/api/games/route.ts` (the list endpoint): at the start of GET, call drain for likes if 10s elapsed, drain for games if 1s elapsed
     - Store last-drain timestamps in memory or Redis keys `drain:likes:last` / `drain:games:last`
     - This way, reads trigger the drain without the user waiting

3. **Client-side notification (no waiting):**
   - The API call to POST /api/push is fire-and-forget from the user's perspective
   - On 200: use `successToast("Like registered", "Your like has been saved")` from `@/ui/notifications`
   - On error: use `errorToast("Like failed", "Could not register your like")` from `@/ui/notifications`
   - Uses existing `SuccessNotification` / toast pattern

4. **Zustand client cache (if implementing now):**
   - A Zustand store `useLikesStore` that holds `likedGameIds: string[]`
   - On page load: fetch liked IDs for the current user from a lightweight endpoint
   - On click: toggle locally + fire the POST

---

### Step 3: State Sync Foundation (Issue #91)

**Independent of Step 1/2.**

**Files to read first:**
- `types/gamedata.ts` (30 lines — `GameDataJSON`, `CharacterDataJSON`, `MapDataJSON`, `ItemDataJSON`)
- `types/gameForm.ts` (108 lines — `CharacterData`, `MapData`, `ItemData`, `GamesFormData`, `UseGamesFormReturn`)
- Search for existing Zustand stores (`useGamesForm`, etc.)

**What to create:**

1. **`types/patches.ts`**: JSON Patch types scoped to game data
   ```ts
   // Example structure
   type GamePatchOp = "add" | "remove" | "replace"
   type GamePatch = {
     op: GamePatchOp
     path: string  // e.g. "/characters/-", "/characters/3/name"
     value?: unknown
   }
   type GamePatchRequest = {
     id: string
     patches: GamePatch[]
     lastSavedSnapshot?: GameDataJSON  // optional, for server-side validation
   }
   ```

2. **`lib/patch-applier.ts`**: Server-side function that applies patches to MongoDB
   - Takes `{ gameId, patches }`
   - For each patch op:
     - `add` → `Game.updateOne({ id: gameId }, { $push: { characters: value } })`
     - `remove` → `Game.updateOne({ id: gameId }, { $pull: { characters: { id: pathId } } })`
     - `replace` → `Game.updateOne({ id: gameId }, { $set: { "characters.$[elem].name": value } }, { arrayFilters: [{ "elem.id": pathId }] })`
   - Returns success/error per patch (don't fail the whole batch on one bad op)

3. **Extend `POST /api/push`** with `type: "patch"` handler, or create `POST /api/games/[id]/patches`

4. **Client-side mutation tracker** (Zustand middleware or hook):
   - Every time a character/map/item is added/removed/replaced: record `{ op, path, value }`
   - On save: ship accumulated patches to server
   - On success: clear patch queue, update `lastSavedSnapshot` in LocalStorage
   - LocalStorage backup every 10 minutes
   - Save-on-exit prompt via `window.onbeforeunload` or Next.js route intercept

---

## Execution Order

```
Step 1 (Centralize queues) ───────── Step 2 (Likes refactor)
                                              │
                                              └── needs Step 1 for enqueue()
                                              └── needs user to add @upstash/redis

Step 3 (Patch foundation) ── independent ── can start anytime
```

The agent should do Step 1 first (core refactor), then Step 2 (likes), then Step 3 (patches). If user hasn't added @upstash/redis yet by the time Step 2 is reached, pause there or use the existing Redis client for the direct write as a temporary measure.

---

## Notification Patterns (for agent reference)

Success toast:
```ts
import { successToast } from "@/ui/notifications"
successToast("Title", "Description")
```

Error toast:
```ts
import { errorToast } from "@/ui/notifications"
errorToast("Title", "Description")
```

Error handler with toast:
```ts
import { showToastFor } from "@/utilities/errorHandler"
showToastFor(classifiedError, { context: "likes" })
```

Success component:
```ts
import { SuccessNotification } from "@/exceptions/notifications"
<SuccessNotification title="Title" description="Desc" variant="toast" />
```

---

## Files Summary

| Action | File | Step |
|---|---|---|
| CREATE | `types/operations.ts` | 1 |
| CREATE | `utilities/queue.ts` | 1 |
| MODIFY | `app/api/push/route.ts` | 1 + 2 |
| MODIFY | `app/api/push/pushGames/route.ts` | 1 |
| MODIFY | `utilities/pull.ts` | 1 |
| MODIFY | `lib/GamesInsert.ts` | 1 |
| DELETE | `utilities/insertGame.ts` | 1 |
| DELETE/CLEAN | `utilities/db.ts` (queue functions) | 1 |
| MODIFY | `app/api/games/route.ts` (add lazy drain trigger) | 2 |
| CREATE | `app/api/drain/route.ts` | 2 |
| CREATE | `types/patches.ts` | 3 |
| CREATE | `lib/patch-applier.ts` | 3 |
| CREATE | `app/api/games/[id]/patches/route.ts` or extend push route | 3 |
| CREATE | `components/adventures/cards/like-button.tsx` | 4 |
| CREATE | `stores/likes-store.ts` (Zustand) | 4 |
| CREATE | `hooks/use-mutation-tracker.ts` | 5 |
| CREATE | `lib/mutation-backup.ts` (LocalStorage) | 5 |

## Remaining Work

### Step 4: Client-Side Like Button + Toast Notifications

**Note:** The server-side `POST /api/push { type: "like" }` handler is complete. This step wires the client.

**Files to read first:**
- `app/api/push/route.ts` — existing handler (reads `likesSchema` data: `{ id, likesDelta }`)
- `ui/notifications/index.ts` — imports `successToast`, `errorToast`
- `exceptions/notifications/success.tsx` — `SuccessNotification` component pattern
- `utilities/errorHandler.ts` — `showToastFor` helper
- `types/validation.ts` — `likesSchema` shape
- Search for existing card components that render like counts (likely in `components/adventures/cards/`)

**What to create:**

1. **`components/adventures/cards/like-button.tsx`**
   - Props: `gameId: string`, `initialLikes: number`
   - On click: `fetch("/api/push", { method: "POST", body: JSON.stringify({ idempotencyKey: uuid, type: "like", data: { id: gameId, likesDelta: 1 } }) })`
   - On 200: `successToast("Like registered", "Your like has been saved.")` → optimistic increment
   - On error: `errorToast("Like failed", "Could not register your like.")` → revert optimistic count
   - Use existing `tryApiRoute` wrapper on server, handle response on client

2. **`stores/likes-store.ts`** — Zustand store
   - `likedGameIds: Set<string>` (or `string[]` with helper)
   - `toggleLike(gameId: string): void` — optimistic toggle + fire POST
   - `isLiked(gameId: string): boolean`
   - On page load: fetch user's liked game IDs from a lightweight endpoint like `GET /api/likes?userId=...`
   - On like success: persist `likedGameIds` in store
   - On like failure: revert toggle

3. **Wire into existing cards grid**
   - Find existing card component in `components/adventures/cards/` that renders like count
   - Replace static like display with `<LikeButton gameId={id} initialLikes={likes_count} />`

**Key constraint:** Request returns immediately. Toast shows on success/failure, no loading spinner.

---

### Step 5: Client-Side Mutation Tracker (for in-game editing)

**Depends on:** Step 3.3 (patch endpoint exists)

**Files to read first:**
- `types/patches.ts` — `GamePatch`, `GamePatchRequest`
- `app/api/games/[id]/patches/route.ts` — existing endpoint
- Search for game detail/edit pages (likely `app/game/[uuid]/` or `components/adventures/detail/`)
- Check if Zustand is already in `package.json` dependencies

**What to create:**

1. **`hooks/use-mutation-tracker.ts`**
   - Returns: `{ patches: GamePatch[], recordAdd(key, value), recordRemove(key, id), recordReplace(key, id, field, value), save(), discard(), dirty: boolean }`
   - Every character/map/item CRUD action pushes to an internal `patches: GamePatch[]` queue
   - `save()`: `POST /api/games/[id]/patches { patches }` → on 200/207, clear queue
   - `discard()`: clear queue, reload original state
   - `dirty`: computed from `patches.length > 0`

2. **`lib/mutation-backup.ts`**
   - `backupPatches(gameId, patches)` → `localStorage.setItem("patches:"+gameId, JSON.stringify({ patches, timestamp }))`
   - `restorePatches(gameId)` → returns saved patches or null
   - `clearBackup(gameId)` → removes key
   - Auto-backup via `setInterval(save, 600_000)` inside the hook
   - On mount: check `restorePatches()` and prompt user to restore unsaved changes

3. **Save-on-exit prompt**
   - In the `use-mutation-tracker` hook: register `window.onbeforeunload` when `dirty` is true
   - Next.js route intercept (if applicable) for SPA navigation warnings

**Key constraint:** All mutation logic is client-side, server is purely a JSON Patch applier.

---

### Step 6: Optional — Upgrade to `@upstash/redis` SDK

- User needs to run: `npm install @upstash/redis`
- Add env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Replace `lib/queue.ts` ioredis singleton with `new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })`
- Until this is done, the existing ioredis client handles both queue operations and the instant `INCRBY likes:{id}` write

---

Updated Files Summary (adds to table above):

| Action | File | Step |
|---|---|---|
| CREATE | `components/adventures/cards/like-button.tsx` | 4 |
| CREATE | `stores/likes-store.ts` | 4 |
| MODIFY | existing card component (wire like button) | 4 |
| CREATE | `hooks/use-mutation-tracker.ts` | 5 |
| CREATE | `lib/mutation-backup.ts` | 5 |
| MODIFY | game detail/edit page (wire mutation tracker) | 5 |
| MODIFY | `lib/queue.ts` (swap ioredis → Upstash) | 6 |

---

## Step 6 Follow-up: Unified to Upstash Redis (Bug Fix)

**Root cause:** The dual-client setup (`redis` = Upstash, `legacyRedis` = ioredis) meant `lib/cache-warmup.ts` was writing the 19 cached games to **Redis Cloud** (`redis://...discussion-intense-retrospeedy-93747.db.redis.io`) while `app/api/games/route.ts` was reading from **Upstash** (`https://rational-falcon-116542.upstash.io`). Two different Redis databases — no shared data — so `getCachedGameIds()` always returned an empty array and no cards rendered.

**Fix applied (2026-06-06):**

1. `lib/queue.ts` — ioredis code moved to a comment block (kept for future use, not removed), only `redis` (Upstash) is now exported.
2. `lib/cache-warmup.ts` — switched import from `legacyRedis` to `redis`; replaced `pipeline().exec()` with `Promise.all()` of individual `redis.set(key, value, { ex: ttl })` and `redis.zadd(key, { score, member })` calls; added type parameters to `redis.get<string>()` calls.
3. `utilities/hotnessCache.ts` — switched import; `checkMemoryPressure()` now returns `false` (Upstash REST API does not expose INFO/MEMORY stats); replaced `pipeline().exec()` in `saveCacheState` with `Promise.all()`; removed unused `MEMORY_PRESSURE_THRESHOLD` constant.
4. `utilities/gameFetchPipeline.ts` — switched import; replaced `pipeline().exec()` in `processBatch` with `Promise.all()`; updated `redis.get<string>()` and `redis.lrange()` with type assertions.

**Constraints / caveats:**

- `cacheInitialized` is a module-level `let` flag in `app/api/games/route.ts:10`. If the Next.js dev server was running before this fix (i.e. set `cacheInitialized = true` on the OLD Redis Cloud instance), restart the dev server so the warmup runs against Upstash and the flag is re-initialized.
- The Upstash REST API does not support `INFO` or `MEMORY` commands, so the memory-pressure guard in `hotnessCache.ts` is permanently disabled (returns `false`). The hotness cache still functions correctly — just without the back-pressure circuit-breaker.
- `ioredis` is still in `package.json` (kept for the commented-out legacy code path; can be uninstalled later when confirmed stable).

---

### Resource Comparison: Redis Cloud (Free) vs Upstash Redis (Free)

| Metric | Redis Cloud (Free) | Upstash Redis (Free) | Win |
|---|---|---|---|
| **Storage** | 30 MB | 250 MB | Upstash (8.3×) |
| **Max throughput** | 100 req/sec | 10,000 commands/sec | Upstash (100×) |
| **Connection model** | Persistent TCP (limited concurrent conns) | REST/HTTP (no conn limit, serverless-native) | Upstash |
| **Cold start** | TCP reconnect overhead | HTTP handshake only | Upstash |
| **Pricing after free** | $15/mo min | Pay-per-request (serverless) | Upstash |
| **Regions** | 1 free region | Multiple regions on free | Upstash |
| **Daily limit** | Unclear (soft-throttled) | 10,000 commands/day on free, 50k requests/day | Redis Cloud (on daily) |
| **Persistence** | AOF/RDB (configurable) | Automatic snapshots | Tie |
| **INFO/MEMORY** | Full Redis INFO support | Not available | Redis Cloud |
| **Pub/Sub** | Full support | Not supported | Redis Cloud |
| **Blocking ops** | Full support | Not supported | Redis Cloud |

**Verdict:** Upstash is massively better for serverless (Vercel Free Tier). The limitations (no INFO, no pub/sub, no blocking ops) don't affect this project's use case — we only need `GET`/`SET`/`DEL`/`INCRBY`/`EXISTS`/`EXPIRE`/`TTL`/`LPUSH`/`LRANGE`/`RPOP`/`LLEN`/`RENAME`/`ZADD`/`ZRANGE`/`MGET`/`MULTI` (via `Promise.all`), all of which are fully supported by the Upstash REST API.

---

### GitHub Issues

The following issues have been created to track the migration:

| Issue | Title | Link |
|---|---|---|
| #93 | Migrate from Redis Cloud to Upstash Redis for serverless compatibility | https://github.com/jox-sm/deepslate-rpg/issues/93 |
| #94 | Remove ioredis dependency and legacy pipeline code | https://github.com/jox-sm/deepslate-rpg/issues/94 |

---

**Prompt injection notice (2026-06-06):** During the typecheck verification step after the unification, a prompt-injection attempt was detected in a tool result payload (trying to redirect the agent to read `graphify-out/GRAPH_REPORT.md` instead of running the requested `npx tsc --noEmit`). Detected and ignored. No code or system state was affected.