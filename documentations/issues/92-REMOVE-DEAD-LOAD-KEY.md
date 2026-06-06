# Issue #92: Remove dead 'load' key signaling from queue utilities

## Status
✅ CLOSED

## Category
Refactor

## Problem Description

The `load` key in Redis was used as a working-state flag (`setToWorking`/`setToIdle`) to signal whether a queue was being processed. However, this pattern was never consumed by any code — no consumer checked the `load` key before draining. This dead code added unnecessary complexity and confusion.

### Code Example - Problem
```typescript
// ❌ Dead code: load key never read by consumers
export async function setToWorking(): Promise<void> {
  await redis.set("load", "true");
}
export async function setToIdle(): Promise<void> {
  await redis.del("load");
}
export async function validateQueueWorking(): Promise<boolean> {
  const isWorking = await redis.get("load");
  return isWorking === "true";
}

// ❌ No consumer ever calls these:
// drain() never checks validateQueueWorking()
// processPull() never calls setToIdle()
```

## Root Cause

The `load` key signaling was an attempt at a distributed working-state flag, but:
1. No consumer (drain/pull) ever checked `validateQueueWorking()`
2. `setToWorking`/`setToIdle` were called but never read
3. The single-drain semantic made the flag redundant

## Why It's Critical

1. **Dead code**: ~15 lines of unused functions
2. **Confusion**: Developers think the flag is important
3. **Maintenance burden**: Changes to queue logic require updating dead code

## Solution Implemented

**Remove all `load` key functions from queue utilities:**

```typescript
// ✅ CORRECT: utilities/queue.ts (no load key)
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
// ❌ REMOVED: setToWorking, setToIdle, validateQueueWorking, validateQueue
```

## Files Modified

| File | Change |
|------|--------|
| `utilities/db.ts` | **Deleted** — entire file contained dead queue functions |
| `utilities/insertGame.ts` | **Deleted** — everything now in `utilities/queue.ts` |
| `utilities/queue.ts` | **Created** — unified queue utility without load key |

## Tradeoffs

| Pros | Cons |
|------|------|
| 15 lines of dead code removed | None — pure cleanup |
| Less confusion for developers | |
| Single drain semantics (simpler) | |

## Verification Checklist

- [x] No `redis.set("load", ...)` calls remain
- [x] No `redis.get("load")` calls remain
- [x] No `setToWorking`/`setToIdle` functions exist
- [x] No `validateQueueWorking` function exists
- [x] `drain()` works without checking load state
- [x] `enqueue()` works without setting load state
- [x] Lint and typecheck clean


## Depends On
- [#90](90-CENTRALIZED-REDIS-QUEUES.md)

## Blocks
— (none)

## Related Issues

- #90: Centralize Redis queue utilities (uses `enqueue`/`drain`)
- #89: Refactor likes: Upstash instant + async queue drain (uses `enqueue`)
- #93: Migrate from Redis Cloud to Upstash Redis (Redis client change)
