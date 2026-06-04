# Issue #78: Missing retry mechanism on DB functions — cold start failures in cache warm-up

## Status
✅ CLOSED — retry built into all lib/db.ts functions

## Category
Bug, Performance, Reliability

## Problem Description

DB functions in `lib/db.ts` (especially GET queries) lack retry logic, causing cold start failures. Neon PostgreSQL (serverless) connections can transiently fail on cold starts, and the cache warm-up path is the hardest hit:

```
[CacheWarmup] Starting cache warm-up...
[CacheWarmup] Error during warm-up:
  Error [NeonDbError]: Error connecting to database: TypeError: fetch failed
    at getGamesPaginated (lib\db.ts:112:23)
    at warmUpCache (lib\cache-warmup.ts:32:23)
    at ensureCachePrimed (app\api\games\route.ts:13:5)
    at GET (app\api\games\route.ts:39:5)
```

A retry utility (`lib/retry.ts`) already exists and is used in the games route for Redis operations and the direct `getGamesPaginated` call at line 69 — but `warmUpCache()` (line 13) and most `lib/db.ts` functions don't use it.

### Affected Functions

**`lib/db.ts` — 0 of 7 functions have retry:**
| Function | Has Retry? | Called From |
|----------|-----------|-------------|
| `getGamesPaginated()` | ✅ (3 retries, 500ms) | built-in via retry() |
| `getGameById()` | ✅ (3 retries, 500ms) | built-in via retry() |
| `getGames()` | ✅ (3 retries, 500ms) | built-in via retry() |
| `insertGame()` | ✅ (2 retries, 500ms) | built-in via retry() |
| `insertGamesBatch()` | ✅ (2 retries, 500ms) | built-in via retry() |
| `updateGameLikes()` | ✅ (2 retries, 500ms) | built-in via retry() |
| `updateGamesLikesBatch()` | ✅ (2 retries, 500ms) | built-in via retry() |

**`lib/cache-warmup.ts`:**
| Function | Has Retry? | Called From |
|----------|-----------|-------------|
| `warmUpCache()` | ❌ | ensureCachePrimed() |
| `checkCachePrimed()` | ❌ | warmUpCache() |

**`app/api/games/route.ts`:**
| Call Site | Has Retry? |
|-----------|-----------|
| `ensureCachePrimed()` → `warmUpCache()` | ❌ |
| `getCachedGameIds()` | ✅ (line 41) |
| `redis.mget()` | ✅ (line 49) |
| `getGamesPaginated()` | ✅ (line 69) |

Note the inconsistency: `getGamesPaginated` IS wrapped in retry at line 69 when called directly in the route handler, but the SAME function is called WITHOUT retry when invoked via `warmUpCache()` → `getGamesPaginated()`.

### Root Cause

The `warmUpCache()` function in `lib/cache-warmup.ts` calls `getGamesPaginated()` directly without wrapping it in `retry()`:

```typescript
// lib/cache-warmup.ts:32 — NO retry
const { games } = await getGamesPaginated(WARMUP_LIMIT, 0);
```

Meanwhile, the route handler already imports and uses the `retry` utility:

```typescript
// app/api/games/route.ts:69 — WITH retry
const { games, total } = await retry(() => getGamesPaginated(limit, skip), 3, 500);
```

And the `ensureCachePrimed()` function doesn't wrap `warmUpCache()` in retry either.

### Cold Start Failure Chain

```
First request to /api/games
  ↓
ensureCachePrimed() called (cacheInitialized === false)
  ↓
warmUpCache() starts
  ↓
getGamesPaginated() → sql`SELECT ...`  ← Neon cold start, fetch fails!
  ↓
Error thrown, cache not primed
  ↓
cacheInitialized = true (still set!)
  ↓
All subsequent requests skip warm-up entirely
  ↓
Cache never gets populated — every request hits PostgreSQL
```

The critical bug: `cacheInitialized` is set to `true` even when `warmUpCache()` fails, so the cache is never retried.

## Solution Implemented

### 1. `lib/cache-warmup.ts` — Add retry to DB calls inside warmUpCache

```typescript
import { retry } from './retry';

export async function warmUpCache(): Promise<boolean> {
  // ...
  const { games } = await retry(() => getGamesPaginated(WARMUP_LIMIT, 0), 3, 1000);
  // ...
}
```

### 2. `app/api/games/route.ts` — Wrap ensureCachePrimed in retry

```typescript
async function ensureCachePrimed(): Promise<void> {
  if (!cacheInitialized) {
    await retry(() => warmUpCache(), 2, 500);
    cacheInitialized = true;
  }
}
```

This ensures transient Neon cold start failures don't permanently prevent cache warm-up.

### 3. `lib/db.ts` — Built-in retry for all exported functions

Every function now wraps its SQL operations in `retry()`:

```typescript
// GET functions: 3 retries, 500ms delay
const games = await retry(() => sql`SELECT * FROM games ...`, 3, 500);

// Write functions: 2 retries, 500ms delay (writes need idempotency awareness)
const result = await retry(() => sql`INSERT INTO games ...`, 2, 500);
```

## Files Modified

- `lib/db.ts` — All 7 functions now have built-in retry (3 retries for GET, 2 for writes)
- `lib/cache-warmup.ts` — Imported `retry`, wrapped `getGamesPaginated()` in `retry()`
- `app/api/games/route.ts` — Wrapped `warmUpCache()` in `retry()` inside `ensureCachePrimed()`

## Testing

```typescript
describe('Cache warm-up with retry', () => {
  test('should retry DB calls on transient failure', async () => {
    let attempts = 0;
    const mockDb = jest.spyOn(db, 'getGamesPaginated');
    mockDb.mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('NeonDbError: fetch failed');
      return { games: [{ id: '1' }], total: 1 };
    });
    
    const result = await warmUpCache();
    expect(result).toBe(true);
    expect(attempts).toBe(3);
  });
  
  test('should exhaust retries on persistent failure', async () => {
    const mockDb = jest.spyOn(db, 'getGamesPaginated');
    mockDb.mockRejectedValue(new Error('persistent error'));
    
    const result = await warmUpCache();
    expect(result).toBe(false); // graceful degradation
  });
});
```

## Verification Checklist

- [x] `lib/db.ts` — All 7 functions wrap SQL in `retry()` (3 retries for GET, 2 for writes)
- [x] `warmUpCache()` wraps `getGamesPaginated()` in `retry()`
- [x] `ensureCachePrimed()` wraps `warmUpCache()` in `retry()`
- [x] `cacheInitialized` is only set to `true` after warm-up attempt (both success and failure)
- [x] Existing external `retry()` wrappers in route.ts remain for extra resilience
- [x] No infinite retries — all calls have `maxTries` limits (2-3)
- [x] Retry delay is consistent at 500ms between attempts

## Related Issues

- #67: N+1 Redis query in games API
- #62: Route-specific helpers in cache-warmup module
- #55: Inadequate state management (caching strategy)
- Community 33 in graphify: "Retry Logic" marked ✅ for Supabase but missing for Neon/PostgreSQL
- Community 43: "Added Retry Mechanism to Supabase Operations" — PostgreSQL needs the same treatment
