# Issue: Cross-Database Read/Write Inconsistency (PostgreSQL + MongoDB)

## Status
✅ RESOLVED

## Category
Data Layer

## Problem Description

Game data is split across PostgreSQL (core scalar fields) and MongoDB (characters/maps/items arrays). The write path was decoupled:

1. `POST /api/push` → enqueues card data to `InsertGames` (PG queue) — drained asynchronously on read
2. `POST /api/push/pushGames` → enqueues extended data to `InsertGamesmongodb` (MongoDB queue) — drained synchronously

If the async PG drain never ran (no read traffic), the game existed in MongoDB but not PG. If the MongoDB drain failed, the game existed in PG but not MongoDB.

At read time, the API merges PG + Mongo results — if one is stale or missing, the user sees partial data.

## Solution

In `POST /api/push/pushGames`, both drains now run concurrently via `Promise.all`:

### Before (decoupled — inconsistency window)

```typescript
await enqueue("mongodb", "games", dbGameData);
await processGamesQueue();                // MongoDB insert only
// PG insert happens later (maybe never)  ← inconsistency
```

### After (concurrent — both databases synced in same request)

```typescript
await enqueue("mongodb", "games", dbGameData);
const [mongoResult, pgResult] = await Promise.all([
  processGamesQueue(),  // MongoDB insert
  drainGames(),         // PG insert       ← both run together
]);
```

If either drain fails, the entire request fails (idempotency key prevents partial retry).

## Tradeoffs

| Pros | Cons |
|------|------|
| Both databases written in the same request | Higher latency per push (both drains must complete) |
| Eliminates orphaned records | If one drain succeeds and the other fails, idempotency prevents retry |
| Simple — no distributed transaction needed | Drains ALL pending queue items, not just the current game |
| Reuses existing `drainGames()` function | |

## Files Modified

| File | Change |
|------|--------|
| `app/api/push/pushGames/route.ts:4` | Added `import { drainGames } from "@/utilities/pull"` |
| `app/api/push/pushGames/route.ts:26-29` | Wrapped `processGamesQueue` + `drainGames` in `Promise.all` |

## Verification

- [x] Both Mongo and PG drains execute concurrently
- [x] If either drain fails, the request fails (idempotency prevents partial writes)
- [x] `enqueue` still happens before drains (data must be in queue first)
- [x] `npm run lint` passes
- [x] `npx tsc --noEmit` passes

## Related Issues

- Documented in `documentations/problems/06-DATA_LAYER_DATABASE_ISSUES.md`
- #04: Serialized Independent DB Queries (read-path parallelization — complementary fix)
