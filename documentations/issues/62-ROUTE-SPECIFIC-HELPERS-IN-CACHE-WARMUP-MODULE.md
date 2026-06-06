# Issue #62: Added route-specific helpers to cache-warmup module

## Status
✅ CLOSED

## Category
Refactor

## Problem Description

Route-specific helper functions (`getMultipleGamesFromCache`, pipeline variant) were added to `lib/cache-warmup.ts`, which is a cache initialization utility module meant for startup-time cache population.

### Code Example - Problem
```typescript
// Problem: Route helpers in wrong module
// lib/cache-warmup.ts (cache initialization module)

// This is correct - cache warmup during startup
export function warmupCache() {
  // Pre-populate cache with data
}

// This is WRONG - runtime route helper in startup module
export function getMultipleGamesFromCache(gameIds: string[]) {
  // Fetch multiple games from cache
  // This belongs in the route, not cache-warmup
}

export function getMultipleGamesFromCacheWithPipeline(gameIds: string[]) {
  // Pipeline variant
  // Also doesn't belong here
}

// Usage problem
import { getMultipleGamesFromCache } from '@/lib/cache-warmup'; // Confusing!
```

## Root Cause

Module responsibility confusion:
- `cache-warmup.ts` has one responsibility: pre-populate cache at startup
- Route helpers have different responsibility: runtime data fetching
- Mixed concerns in same module
- Misleading module name

## Why It's Critical

1. **Confusion**: Module name doesn't reflect contents
2. **Maintenance**: Hard to find helpers
3. **Responsibility**: Single Responsibility Principle violated
4. **Naming**: Misleading imports
5. **Testing**: Cache initialization and runtime fetching mixed

## Solution Implemented

**Separate concerns into appropriate modules:**

```typescript
// ✅ CORRECT: lib/cache-warmup.ts (startup-only)
import { redis } from '@/lib/redis';
import { db } from '@/lib/db';

// Only cache initialization at startup
export async function warmupGameCache() {
  try {
    const games = await db.query('SELECT id, title, description FROM games');
    
    for (const game of games) {
      await redis.set(`game:${game.id}`, JSON.stringify(game));
    }
    
    console.log(`[Cache] Warmed up ${games.length} games`);
  } catch (error) {
    console.error('[Cache] Warmup failed:', error);
  }
}

// ✅ CORRECT: lib/cacheQueries.ts (runtime queries)
import { redis } from '@/lib/redis';

export async function getMultipleGamesFromCache(gameIds: string[]) {
  if (gameIds.length === 0) return [];
  
  const keys = gameIds.map(id => `game:${id}`);
  const data = await redis.mget(keys);
  
  return data
    .filter((item): item is string => item !== null)
    .map(item => JSON.parse(item));
}

export async function getMultipleGamesFromCacheWithPipeline(gameIds: string[]) {
  const pipeline = redis.pipeline();
  
  gameIds.forEach(id => {
    pipeline.get(`game:${id}`);
  });
  
  const results = await pipeline.exec();
  
  return results
    .map(([_, data]) => data)
    .filter((item): item is string => item !== null)
    .map(item => JSON.parse(item));
}

// ✅ CORRECT: app/api/games/route.ts (route handler)
import { getMultipleGamesFromCache } from '@/lib/cacheQueries';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '0');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  
  const gameIds = await redis.lrange('games', page * limit, (page + 1) * limit - 1);
  
  const games = await getMultipleGamesFromCache(gameIds);
  
  return Response.json({ games });
}
```

## File Structure

```
Before (Problem):
└── lib/
    └── cache-warmup.ts (contains both startup + runtime functions)

After (Correct):
└── lib/
    ├── cache-warmup.ts (only startup initialization)
    ├── cacheQueries.ts (runtime cache queries)
    └── redis.ts (Redis client)
```

## Module Responsibilities

### lib/cache-warmup.ts
```typescript
// Run once at startup
// Pre-populate cache with application data
export async function warmupGameCache() { }
export async function warmupUsersCache() { }
export async function warmupAllCaches() { }
```

### lib/cacheQueries.ts
```typescript
// Used during runtime by routes
// Fetch data from cache
export async function getGameFromCache(id: string) { }
export async function getMultipleGamesFromCache(ids: string[]) { }
export async function getUserFromCache(id: string) { }
```

## Best Practice Pattern

```typescript
// Separation of concerns

// 1. Initialization (lib/cache-warmup.ts)
export async function initializeCache() {
  // Called in app startup/bootstrap
  // Pre-populate caches
}

// 2. Queries (lib/queries/cache.ts)
export async function getGameFromCache(id: string) {
  // Called during request handling
  // Get data from cache
}

// 3. Routes (app/api/games/route.ts)
import { getGameFromCache } from '@/lib/queries/cache';

export async function GET(req: Request) {
  const game = await getGameFromCache(id);
  return Response.json(game);
}
```

## Files Modified

- Created: `lib/cacheQueries.ts` - Runtime cache query helpers
- Updated: `lib/cache-warmup.ts` - Removed runtime helpers (kept only initialization)
- Updated: All route files - Import from correct modules

## Migration Checklist

- [x] Create new `cacheQueries.ts` module
- [x] Move runtime helpers from `cache-warmup.ts`
- [x] Update all imports in route handlers
- [x] Keep only initialization functions in `cache-warmup.ts`
- [x] Verify module responsibilities clear
- [x] Update tests

## Testing

```typescript
describe('Cache Warmup', () => {
  test('should only initialize cache at startup', async () => {
    await warmupGameCache();
    // Should populate cache with game data
  });
});

describe('Cache Queries', () => {
  test('should fetch games from cache', async () => {
    const games = await getMultipleGamesFromCache(['id1', 'id2']);
    expect(games).toBeDefined();
  });

  test('should handle missing cache entries', async () => {
    const games = await getMultipleGamesFromCache(['missing-id']);
    expect(games).toEqual([]);
  });
});
```

## Documentation

```typescript
/**
 * lib/cache-warmup.ts
 * 
 * Cache initialization functions
 * 
 * These functions are run at application startup to pre-populate
 * the cache with frequently accessed data.
 * 
 * Usage:
 *   import { warmupGameCache } from '@/lib/cache-warmup';
 *   
 *   // In app bootstrap
 *   await warmupGameCache();
 */

/**
 * lib/cacheQueries.ts
 * 
 * Runtime cache query helpers
 * 
 * These functions fetch data from cache during request handling.
 * 
 * Usage:
 *   import { getMultipleGamesFromCache } from '@/lib/cacheQueries';
 *   
 *   // In route handlers
 *   const games = await getMultipleGamesFromCache(gameIds);
 */
```

## Verification Checklist

- [x] Helper functions moved to correct module
- [x] Module responsibilities clear
- [x] Import paths updated in routes
- [x] No functionality changed
- [x] Tests passing
- [x] Code clarity improved


## Depends On
— (none)

## Blocks
- [#78](78-DB-RETRY-MECHANISM.md)

## Related Issues

- #40: Added route-specific helpers to cache-warmup module (duplicate)
- #11: Added route-specific helpers to cache-warmup module (duplicate)
