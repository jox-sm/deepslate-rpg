# Issue #94: Remove ioredis Dependency and Legacy Pipeline Code

## Status
🔄 OPEN

## Category
Cleanup

## Problem Description

After migrating to Upstash Redis (#93), the `ioredis` package and its associated pipeline code are no longer used. The code is currently commented out in `lib/queue.ts` but still occupies bundle space and creates confusion.

### Code Example - Current State
```typescript
// lib/queue.ts (current - commented out)
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

## Root Cause

The migration to Upstash Redis (#93) was completed but the cleanup step (removing ioredis) was deferred to avoid breaking changes during the same PR.

## Why It's Critical

1. **Dead code**: Commented-out code adds maintenance burden
2. **Confusion**: Developers may think ioredis is still needed
3. **Bundle size**: ioredis package still in node_modules
4. **Environment variable**: `redisqueue` env var no longer needed

## Solution Implemented

**To be completed in follow-up PR:**

```typescript
// ✅ TARGET: lib/queue.ts (clean)
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export { redis };
```

## Tasks

- [ ] Uninstall `ioredis` from `package.json`
- [ ] Delete commented-out ioredis block from `lib/queue.ts`
- [ ] Remove `redisqueue` from `.env` and `.env.local`
- [ ] Verify no remaining references to `legacyRedis` or `ioredis`
- [ ] Run lint + typecheck to confirm clean

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Remove `ioredis` dependency |
| `lib/queue.ts` | Remove commented-out ioredis block |
| `.env` | Remove `redisqueue` variable |
| `.env.local` | Remove `redisqueue` variable |

## Tradeoffs

| Pros | Cons |
|------|------|
| Cleaner codebase (no dead code) | Can't easily revert to ioredis |
| Smaller bundle size (~100KB) | Must ensure Upstash handles all edge cases |
| Less confusion for new developers | No fallback if Upstash has outage |
| One less env variable to manage | Must update deployment configs |

## Verification Checklist

- [ ] `npm uninstall ioredis` succeeds
- [ ] `package.json` no longer lists ioredis
- [ ] `lib/queue.ts` has no commented code
- [ ] `redisqueue` removed from `.env` and `.env.local`
- [ ] `grep -r "legacyRedis" .` returns no results
- [ ] `grep -r "ioredis" .` returns no results (except node_modules)
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] All functionality works (cache warmup, likes, games)

## Blockers

- None — this is a pure cleanup issue
- Can be done after #93 is confirmed stable


## Depends On
- [#93](93-MIGRATE-TO-UPSTASH-REDIS.md)

## Blocks
— (none)

## Related Issues

- #93: Migrate to Upstash Redis (completed, this is cleanup)
- #90: Centralized Redis Queues (uses `enqueue` utility)
