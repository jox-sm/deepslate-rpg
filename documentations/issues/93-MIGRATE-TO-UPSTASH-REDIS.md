# Issue #93: Migrate from Redis Cloud to Upstash Redis

## Status
✅ CLOSED

## Category
Infrastructure

## Problem Description

The project used two Redis clients simultaneously:
1. **ioredis** (`lib/queue.ts`) → `redis://...discussion-intense-retrospeedy-93747.db.redis.io:18092` (Redis Cloud Free)
2. **@upstash/redis** (`lib/queue.ts`) → `https://rational-falcon-116542.upstash.io` (Upstash Free)

This caused a **split-brain bug**: `cache-warmup.ts` wrote 19 games to Redis Cloud, but `app/api/games/route.ts` read from Upstash — different databases, no shared data, so no cards rendered.

### Code Example - Problem
```typescript
// ❌ lib/queue.ts (dual-client before fix)
import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const legacyRedisClient = () => {
  return new IORedis(process.env.redisqueue!); // Redis Cloud
};

export { redis, legacyRedis };

// ❌ lib/cache-warmup.ts
import { legacyRedis as redis } from './queue'; // Writes to Redis Cloud
await redis.pipeline().set(key, value, 'EX', ttl).exec(); // ioredis style

// ❌ app/api/games/route.ts
import { redis } from '@/lib/queue'; // Reads from Upstash
const values = await redis.mget(...keys); // Upstash style
```

## Root Cause

When `@upstash/redis` was added as a new dependency, the cache-warmup code was switched to import `legacyRedis` (ioredis) to preserve pipeline functionality, but the read path (`app/api/games/route.ts`) was left importing `redis` (Upstash). Two different Redis databases with no shared data.

## Why It's Critical

1. **Complete data loss**: Cards never render (0 games found in Upstash)
2. **Silent failure**: HTTP 200 response with empty data array
3. **Hard to diagnose**: Both Redis instances healthy, just different data
4. **Server restart required**: `cacheInitialized` module flag persists in memory

## Solution Implemented

**Unified on Upstash Redis with `Promise.all` replacing pipelines:**

```typescript
// ✅ CORRECT: lib/queue.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Legacy ioredis (Redis.io / Redis Cloud) — kept for future use ───
// import IORedis from 'ioredis';
//
// const legacyRedisClient = () => {
//   if (!process.env.redisqueue) throw new Error("REDIS_URL is missing!");
//   return new IORedis(process.env.redisqueue);
// };
//
// const globalForRedis = global as unknown as { legacyRedis: IORedis };
// const legacyRedis = globalForRedis.legacyRedis || legacyRedisClient();
// if (process.env.NODE_ENV !== 'production') globalForRedis.legacyRedis = legacyRedis;
//
// export { redis, legacyRedis };

export { redis };
```

```typescript
// ✅ CORRECT: lib/cache-warmup.ts
import { redis } from './queue'; // Upstash only

// Pipeline → Promise.all
const operations: Promise<unknown>[] = [];
const gameIds: string[] = [];

for (const game of games) {
  const key = `${CACHE_KEYS.GAME_PREFIX}${game.id}`;
  const gameData = JSON.stringify(game);
  operations.push(redis.set(key, gameData, { ex: CACHE_TTL })); // Upstash options
  gameIds.push(game.id);
}

if (gameIds.length > 0) {
  operations.push(redis.del(CACHE_KEYS.GAME_IDS_SET));
  for (let i = 0; i < gameIds.length; i++) {
    operations.push(redis.zadd(CACHE_KEYS.GAME_IDS_SET, { score: i + 1, member: gameIds[i] }));
  }
}

await Promise.all(operations);
```

## Resource Comparison

| Metric | Redis Cloud (Free) | Upstash Redis (Free) |
|---|---|---|
| **Storage** | 30 MB | 250 MB |
| **Max throughput** | 100 req/sec | 10,000 commands/sec |
| **Connection model** | Persistent TCP (limited concurrent conns) | REST/HTTP (no conn limit, serverless-native) |
| **Cold start** | TCP reconnect overhead | HTTP handshake only |
| **Pricing after free** | $15/mo min | Pay-per-request (serverless) |
| **INFO/MEMORY** | Full support | Not available |
| **Pub/Sub** | Full support | Not supported |

## Files Modified

| File | Change |
|------|--------|
| `lib/queue.ts` | ioredis moved to comments, only Upstash `redis` exported |
| `lib/cache-warmup.ts` | `pipeline().exec()` → `Promise.all()`; `redis.set(key, value, { ex })` |
| `utilities/hotnessCache.ts` | `checkMemoryPressure()` returns `false`; `pipeline()` → `Promise.all()` |
| `utilities/gameFetchPipeline.ts` | `pipeline().exec()` → `Promise.all()` |
| `utilities/idempotency.ts` | `redis.set(key, value, 'EX', ttl)` → `redis.set(key, value, { ex: ttl })` |

## Tradeoffs

| Pros | Cons |
|------|------|
| 250 MB storage (8.3× more) | No INFO/MEMORY commands |
| 10,000 commands/sec (100× more) | No Pub/Sub support |
| Serverless-native (no cold start) | REST slightly higher per-request latency (~1-3ms) |
| Pay-per-request pricing | Less control over connection pooling |
| Unified codebase (one Redis) | ioredis code kept as comments (temporary) |

## Verification Checklist

- [x] `redis.set(key, value, { ex: ttl })` works
- [x] `redis.get<string>(key)` works
- [x] `redis.mget<string[]>(...keys)` works
- [x] `redis.zadd(key, { score, member })` works
- [x] `redis.zrange(key, 0, -1)` works
- [x] `redis.del(key)` works
- [x] `redis.incrby(key, delta)` works
- [x] `redis.rpush(key, value)` works
- [x] `redis.lrange(key, 0, -1)` works
- [x] `redis.llen(key)` works
- [x] `redis.rename(key, newKey)` works
- [x] Cache warmup writes to Upstash (not Redis Cloud)
- [x] Games route reads from Upstash (matches warmup)
- [x] Cards render on page load
- [x] Lint and typecheck clean

## Remaining

- **#94**: Remove ioredis dependency and legacy pipeline code
- **Server restart required**: After fix, restart dev server to reset `cacheInitialized` flag


## Depends On
- [#90](90-CENTRALIZED-REDIS-QUEUES.md)

## Blocks
- [#94](94-REMOVE-IORedis.md)

## Related Issues

- #90: Centralized Redis Queues (uses `enqueue` utility)
- #89: Likes System Instant Write (uses `redis.incrby()`)
- #94: Remove ioredis (cleanup follow-up)
