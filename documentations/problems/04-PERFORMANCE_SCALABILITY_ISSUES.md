# Performance & Scalability Issues

## New Findings (Not in 02-KNOWN_ISSUES.md)

### 1. Hotness Cache Full State Transfer Amplification
**Severity:** CRITICAL
**Location:** `utilities/hotnessCache.ts:146-181`
**Status:** ❌ Unresolved

**Description:**
Every cache hit in the hotness cache calls `loadCacheState()`, which fetches **three large Redis keys** (`cache:views:array`, `cache:data:array`, `cache:hashmap:map`) via individual GET requests. With `MAX_CACHE_ENTRIES = 1000`, the `cache:data:array` contains up to 1000 compressed game objects (potentially multiple MB in serialized form). After reconstructing Maps via `JSON.parse` and processing the hit, `saveCacheState()` re-serializes all three structures back to Redis — every single time.

This means each cache hit performs a full-dataset download + re-upload of the entire hotness cache, making it O(N) per hit instead of O(1). Under load (e.g., 100 gamepage requests/second), this becomes catastrophic bandwidth amplification against Upstash Redis, which bills per request size.

**Impact:**
- Every cache hit transfers the entire cache state (3 large keys) from Redis → server → Redis
- At high concurrency, serialization/deserialization of 1000 entries per request causes CPU spikes
- Upstash Redis HTTP costs scale linearly with N, despite needlessly re-writing unchanged data
- Redis rate limits may be hit under modest traffic

**Suggested Remediation:**
Restructure the hotness cache to avoid full-state serialization:
- Use Redis sorted sets (`ZINCRBY` for view counts, `ZRANGE` for top-N reads) instead of maintaining parallel arrays in application code
- Or isolate the hotness tracking into a lightweight `Hotness` counter (separate Redis key) that increments atomically — only promote to main cache when hotness crosses threshold, without dragging the entire cache state around
- Use `redis.pipeline()` to batch the 3 GET calls into a single HTTP round-trip

---

### 2. Redis `rename` in Drain Pattern Causes Silent Data Loss Under Concurrency
**Severity:** CRITICAL
**Location:** `utilities/queue.ts:26`
**Status:** ❌ Unresolved

**Description:**
The `drain()` function atomically renames the queue key to a temp processing key via `redis.rename(redisKey, tempKey)`. If two drain calls execute concurrently (e.g., from two API server instances or rapid sequential requests), the second `rename` silently overwrites the first's `tempKey`. The first batch of jobs becomes orphaned — the temp key is gone, jobs are lost permanently.

The function then reads ALL items from the queue in a single `redis.lrange(tempKey, 0, -1)` call, which for large queues (hundreds/thousands of pending games) pulls everything into memory at once.

**Impact:**
- Concurrent drain operations cause permanent job loss with no error signal
- No dead-letter queue mechanism — failed or lost jobs are silently dropped
- `lrange` on large queues causes Redis memory spikes and slow response times
- Queue processing is not fault-tolerant in multi-instance deployments

**Suggested Remediation:**
- Replace `rename` with a Lua script that atomically pops items in batches: `redis.eval("local items = redis.call('LRANGE', KEYS[1], 0, ARGV[1]-1); redis.call('LTRIM', KEYS[1], ARGV[1], -1); return items", ...)`
- Or use `RPOPLPUSH` (or `BRPOPLPUSH`) to move items atomically to a processing list, then `LREM` after successful processing — with a dead-letter queue for failures
- Add `RETURNED` value length limit to avoid oversized responses

---

### 3. Convex `remove` Mutation Exceeds Function Budget for Large Games
**Severity:** HIGH
**Location:** `convex/games.ts:55-83`
**Status:** ❌ Unresolved

**Description:**
The `remove` mutation deletes a game and its children by first calling `.collect()` (unbounded) on three separate indexes (characters, maps, items), then iterating each result with sequential `ctx.db.delete()` calls in a `for` loop. Convex mutations have a **5-second timeout** and an **OCC conflict budget** — a game with 50+ characters + 20 maps + 30 items would issue 100+ individual write operations in a single mutation. This routinely causes:
- `Mutation too large` errors
- OCC conflict retries that compound the problem
- Timeout failures mid-way through, leaving partial deletion

The `.collect()` calls are also unbounded — a game with 1000+ children would hit Convex's 5000-row read limit.

**Impact:**
- Delete operations on popular/growth games silently fail or partially complete
- Orphaned child documents accumulate in Convex tables
- OCC retries multiply the write load on the system
- No idempotency in partial-failure scenarios — some children deleted, some not

**Suggested Remediation:**
- Move child deletion to a **Convex Action** (which has a 15-minute timeout and no OCC limitations) instead of a mutation
- Within the action, use `ctx.runMutation()` in batches of 10-20 deletions, or use `ctx.db.delete()` directly in the action
- Add a paginated deletion pattern: delete in batches of 50, re-query, repeat
- Consider a scheduled function / cron for batch cleanup instead of blocking the user request

---

### 4. Serialized Independent DB Queries Double Cache-Miss Latency
**Severity:** HIGH
**Location:** `app/api/games/[id]/route.ts:31-46` and `app/api/games/[id]/route-gamepage.ts:44-51`
**Status:** ❌ Unresolved

**Description:**
On cache miss, both game detail routes perform two independent queries sequentially:

```typescript
const pgGame = await retry(() => getGameById(id), 3, 500);       // First
const mongoGame = await retry(() => Game.findOne({ id }).lean(), 3, 500); // Second (blocked on first)
```

PostgreSQL and MongoDB queries have **zero data dependency** — they read completely disconnected data stores. Sequential execution adds the full latency of both queries plus both retry chains. With retries configured at 3 tries × 500ms base delay, a single cold-path request can take 3+ seconds when both databases experience contention.

**Impact:**
- Cache-miss latency is doubled vs. potential parallel execution
- The retry chain compounds — if PG has issues, MongoDB's retry hasn't even started yet
- User-visible latency spikes on cold starts or cache evictions
- The same antipattern is duplicated in both route files

**Suggested Remediation:**
Execute both fetches concurrently:

```typescript
const [pgGame, mongoGame] = await Promise.all([
  retry(() => getGameById(id), 3, 500),
  retry(() => connectDB().then(() => Game.findOne({ id }).lean()), 3, 500),
]);
```

---

### 5. Like Count Dual-Write Pattern Causes Infinite Redis Cache Growth
**Severity:** HIGH
**Location:** `app/api/push/route.ts:63-66`
**Status:** ❌ Unresolved

**Description:**
When processing a "like" event, the push route performs two writes on different Redis keys:

1. `redis.incrby("likes:" + likeData.id, likeData.likesDelta)` — immediate hot counter
2. `enqueue("neon", "likes", likeData)` — queues for batch drain to PostgreSQL

The `likes:${id}` Redis key is **never decremented or synced back** from PostgreSQL. Over time, if a game receives 10,000 likes, the Redis `likes:${id}` key grows to `10000` while PostgreSQL also independently accumulates the same deltas. The Redis hot counter diverges infinitely from the database, accumulating stale heat indefinitely.

Additionally, the Redis `incrby` call happens BEFORE the drain enqueue — if the drain processes the queue item before the incrby completes (or if the incrby succeeds but the enqueue fails), the two systems permanently diverge.

**Impact:**
- Redis likes counters grow unboundedly — never garbage-collected
- After millions of likes across all games, Redis memory waste accumulates
- No mechanism exists to reconcile Redis hot likes with DB-persisted likes
- On server restart, Redis hot counters vanish (unless persisted) while DB retains correct count — cold-start metrics are wrong

**Suggested Remediation:**
- Decouple: use ONLY the queue-based drain for like persistence, and let the Redis hot counter TTL-expire (add `EX` to `incrby` or use a separate ephemeral cache)
- Or implement a reconciliation cron: periodically sync `likes:${id}` counters from PostgreSQL back to Redis with TTL
- Or remove the redundant `incrby` and rely solely on the drain + cache-backfill pattern (like the games cache already does)

---

### 6. Cache Warmup Issues Independent HTTP Requests Instead of Redis Pipeline
**Severity:** MEDIUM
**Location:** `lib/cache-warmup.ts:42-58`
**Status:** ❌ Unresolved

**Description:**
The cache warmup loop pushes individual `redis.set()` and `redis.zadd()` operations into a `Promise.all()`:

```typescript
for (const game of games) {
  operations.push(redis.set(key, gameData, { ex: CACHE_TTL }));
  ...
  operations.push(redis.zadd(CACHE_KEYS.GAME_IDS_SET, { score: i + 1, member: gameIds[i] }));
}
await Promise.all(operations);
```

With Upstash Redis (HTTP-based), each `redis.set()` and `redis.zadd()` is an **individual HTTPS request**. For 100 games, this generates ~101 separate HTTP requests (100 game SETs + 100 ZADDs + 1 DEL = actually 201+ requests, though some overlap). The Upstash `pipeline()` API can batch these into ~10-15 pipelined batches, reducing HTTP overhead by ~90%.

**Impact:**
- Cache warmup for 100 games generates 200+ individual HTTP round-trips to Upstash Redis
- Each round-trip has ~5-50ms overhead for TLS + DNS + connection setup
- Warmup takes 2-10 seconds instead of sub-second
- On serverless cold starts, this delay blocks the first user requests

**Suggested Remediation:**
Use Upstash Redis pipeline: `redis.pipeline()` with `.set()` and `.zadd()` commands, then `.exec()` in 1-2 batches. Or batch all 100 game entries as a single multi-key operation where possible.

---

### 7. Convex `list` Query Has No Server-Side Pagination Guard
**Severity:** MEDIUM
**Location:** `convex/games.ts:5-13`
**Status:** ❌ Unresolved

**Description:**
The `list` query passes `paginationOpts` directly from the client to `.paginate()` without any server-side caps on `numItems`:

```typescript
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db.query("games").order("desc").paginate(args.paginationOpts);
  },
});
```

The `paginationOptsValidator` accepts any `numItems` up to the Convex default maximum (~8192 bytes of serialized data). A client requesting `numItems: 100` triggers a subscription that reads and transmits 100 full game documents. Multiple clients doing this simultaneously multiplies the read-amplification. Furthermore, there is no Convex index on `_creationTime` (which `.order("desc")` resolves to), meaning the pagination may degrade as the table grows.

**Impact:**
- Read amplification: 100 documents per subscription × N concurrent users
- No cap on `numItems` — a misbehaving client can request excessive data
- Missing `_creationTime` index may cause pagination performance to degrade with table size
- Subscriptions re-run on every mutation to the `games` table, even if those mutations don't affect the paginated window

**Suggested Remediation:**
- Add `args.numItems: v.optional(v.number())` with a `Math.min(50, ...)` server-side cap
- Add an index on `_creationTime` to optimize the default `.order("desc")` pagination
- Consider using point-in-time reads instead of subscriptions if live updates aren't valuable (per Convex subscription cost guideline)

---

### 8. `getGamesPaginated` Always Runs `COUNT(*)` Even When Unnecessary
**Severity:** LOW
**Location:** `lib/db.ts:130-134`
**Status:** ❌ Unresolved

**Description:**
The `getGamesPaginated` function unconditionally runs `SELECT COUNT(*) as total FROM games` after every paginated query, even when the caller doesn't need the total count. `COUNT(*)` on a PostgreSQL `games` table triggers a sequential scan that grows linearly with table size. In the `GET /api/games` route (`app/api/games/route.ts:80`), this fallback path is only hit when the page offset exceeds the cached game IDs — meaning the count query runs for deep pagination pages, where it's most expensive.

**Impact:**
- Sequential `COUNT(*)` scan becomes slower as the games table grows
- Deep pagination (pages beyond cache) has compounding latency
- No caching of total count — every deep page request re-scans the entire table

**Suggested Remediation:**
- Split into two functions: `getGamesPaginated` (without count) and `getGamesPaginatedWithCount` (with count)
- Cache the `total` count in Redis with a 60-second TTL, invalidated on game insert/delete
- Or use PostgreSQL's `EXPLAIN` estimated row count for approximate pagination metadata

---

## Summary

| # | Issue | Severity | Location | Impact |
|---|-------|----------|----------|--------|
| 1 | Hotness Cache Full State Transfer | CRITICAL | `utilities/hotnessCache.ts:146` | O(N) per hit, massive data amplification |
| 2 | Redis `rename` Concurrent Data Loss | CRITICAL | `utilities/queue.ts:26` | Silent job loss in multi-instance |
| 3 | Convex Remove Budget Exceeded | HIGH | `convex/games.ts:55` | Mutation failures, orphaned children |
| 4 | Serialized Independent DB Queries | HIGH | `app/api/games/[id]/route.ts:31` | Double cache-miss latency |
| 5 | Like Count Dual-Write Divergence | HIGH | `app/api/push/route.ts:64` | Infinite Redis key growth, inconsistency |
| 6 | Cache Warmup No Pipeline | MEDIUM | `lib/cache-warmup.ts:42` | 200+ HTTP requests for 100 games |
| 7 | Convex Pagination No Server Guard | MEDIUM | `convex/games.ts:5` | Read amplification, no cap |
| 8 | Unnecessary COUNT(*) Queries | LOW | `lib/db.ts:130` | Sequential scan on deep pagination |
