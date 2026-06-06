# Issue #90: Centralized Redis Queues - Unified Queue Utility

## Status
✅ CLOSED

## Category
Refactor

## Problem Description

Redis queue logic was duplicated across two files (`utilities/db.ts` and `utilities/insertGame.ts`), each implementing their own `pushGameToQueue()`, `getGamesQueue()`, `validateQueue()`, `setToWorking()`, `setToIdle()` functions. This led to:
1. Code duplication (same RPUSH/LRANGE/RENAME pattern copy-pasted)
2. Divergent implementations (Neon path vs MongoDB path)
3. Dead `load` key signaling (not recognized by any consumer)
4. Hard-to-maintain queue logic scattered across codebase

### Code Example - Problem
```typescript
// ❌ DUPLICATE: utilities/db.ts (Neon path)
export async function pushGameToQueue(taskData: GameCardProps) {
  await redis.rpush("InsertGames", JSON.stringify(taskData));
}
export async function getGamesQueue() {
  await redis.rename("InsertGames", "temp");
  const tasks = await redis.lrange("temp", 0, -1);
  // ...
}
export async function validateQueue() { /* load key check */ }
export async function setToWorking() { await redis.set("load", "true"); }
export async function setToIdle() { await redis.del("load"); }

// ❌ DUPLICATE: utilities/insertGame.ts (MongoDB path)
export async function pushGameToQueue(gameData: GamesFormDataDB) {
  await redis.rpush("InsertGamesmongodb", JSON.stringify(gameData));
}
export async function getGamesQueue() {
  await redis.rename("InsertGamesmongodb", "temp");
  const tasks = await redis.lrange("temp", 0, -1);
  // ...
}
export async function validateQueue() { /* same load key */ }
export async function setToWorking() { await redis.set("load", "true"); }
export async function setToIdle() { await redis.del("load"); }
```

## Root Cause

Queue logic was created incrementally as the Neon and MongoDB paths were added, without a shared abstraction. The `load` key signaling was an attempt at a working-state flag that nobody consumed.

## Why It's Critical

1. **Maintenance burden**: Changes to queue logic require updating 2 files
2. **Bug risk**: Divergent implementations can silently desync
3. **Dead code**: `load` key, `setToWorking/setToIdle` are never read
4. **Readability**: 100+ lines of duplicated queue boilerplate

## Solution Implemented

**Unified queue utility with provider-based key resolution:**

```typescript
// ✅ CORRECT: types/operations.ts
export type OperationProvider = "neon" | "mongodb";
export type QueueName = "games" | "likes";

export const queueConfig: Record<string, { redisKey: string }> = {
  "neon:games": { redisKey: "InsertGames" },
  "neon:likes": { redisKey: "InsertLikes" },
  "mongodb:games": { redisKey: "InsertGamesmongodb" },
};

// ✅ CORRECT: utilities/queue.ts
import { redis } from "@/lib/queue";

export async function enqueue(provider: OperationProvider, queue: QueueName, payload: unknown): Promise<void> {
  const config = queueConfig[`${provider}:${queue}`];
  if (!config) throw new Error(`Unknown queue: ${provider}:${queue}`);
  const serialized = JSON.stringify(payload);
  await redis.rpush(config.redisKey, serialized);
}

export async function drain<T>(provider: OperationProvider, queue: QueueName): Promise<{ processed: number }> {
  const config = queueConfig[`${provider}:${queue}`];
  if (!config) throw new Error(`Unknown queue: ${provider}:${queue}`);
  
  const redisKey = config.redisKey;
  const tempKey = `${redisKey}:temp`;
  
  try {
    await redis.rename(redisKey, tempKey);
    const items = (await redis.lrange(tempKey, 0, -1)) as string[];
    
    if (items.length === 0) {
      return { processed: 0 };
    }
    
    const parsed = items
      .map((item) => { try { return JSON.parse(item); } catch { return null; } })
      .filter(Boolean) as T[];
    
    await redis.del(tempKey);
    return { processed: parsed.length };
  } catch {
    await redis.del(tempKey).catch(() => {});
    return { processed: 0 };
  }
}

export async function queueSize(provider: OperationProvider, queue: QueueName): Promise<number> {
  const config = queueConfig[`${provider}:${queue}`];
  if (!config) throw new Error(`Unknown queue: ${provider}:${queue}`);
  return await redis.llen(config.redisKey);
}
```

## Files Modified

| File | Change |
|------|--------|
| `types/operations.ts` | **Created** - Provider type, queue config registry |
| `utilities/queue.ts` | **Created** - `enqueue`, `drain`, `queueSize` |
| `app/api/push/route.ts` | Replaced `pushGameToQueue` with `enqueue("neon", ...)` |
| `app/api/push/pushGames/route.ts` | Replaced `pushGameToQueue` with `enqueue("mongodb", ...)` |
| `utilities/pull.ts` | Split into `drainLikes()` and `drainGames()` |
| `lib/GamesInsert.ts` | Uses `drain("mongodb", "games")` |
| `utilities/db.ts` | **Deleted** - queue functions removed |
| `utilities/insertGame.ts` | **Deleted** - everything now in `utilities/queue.ts` |

## Tradeoffs

| Pros | Cons |
|------|------|
| Single source of truth for queue logic | Slight learning curve for provider/queue API |
| Dead code removed (load key, setToWorking/setToIdle) | Breaking change for any code importing old paths |
| Redis key mapping centralized in one place | Redis key names hardcoded (not config-driven) |
| `drain()` handles parse errors gracefully | `RENAME` + `LRANGE` still used (not atomic) |

## Verification Checklist

- [x] `enqueue("neon", "games", data)` writes to `InsertGames`
- [x] `enqueue("neon", "likes", data)` writes to `InsertLikes`
- [x] `enqueue("mongodb", "games", data)` writes to `InsertGamesmongodb`
- [x] `drain("neon", "games")` reads from `InsertGames` and deletes
- [x] No remaining imports from `@/utilities/db` (queue functions)
- [x] No remaining imports from `@/utilities/insertGame`
- [x] `utilities/db.ts` deleted
- [x] `utilities/insertGame.ts` deleted
- [x] Lint and typecheck clean


## Depends On
— (none)

## Blocks
- [#89](89-LIKES-SYSTEM-INSTANT-WRITE.md)
- [#91](91-STATE-SYNC-JSON-PATCH.md)
- [#92](92-REMOVE-DEAD-LOAD-KEY.md)
- [#93](93-MIGRATE-TO-UPSTASH-REDIS.md)

## Related Issues

- #89: Likes System Instant Write (uses `enqueue("neon", "likes", ...)`)
- #91: State Sync JSON Patch (future use of `enqueue`)
- #93: Migrate to Upstash Redis (Redis client change)
