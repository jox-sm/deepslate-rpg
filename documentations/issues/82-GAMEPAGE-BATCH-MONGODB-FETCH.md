# Issue #82: GamePage: Implement batch MongoDB fetch via Redis queue

## Status
🔄 OPEN

## Category
Feature, Performance, Infrastructure

## Problem Description
Each GamePage request (`GET /api/games/[id]`) performs a direct `Game.findOne({ id })` MongoDB query. At 100+ concurrent requests:

1. **MongoDB connection pool saturates** — Each connection consumes a thread on the server
2. **Query latency spikes** — Contention under concurrent `findOne` calls degrades p50 from 15ms to 100ms+
3. **No deduplication** — 50 users requesting the same game cause 50 identical MongoDB queries
4. **No caching bridge** — Redis cache is checked but the DB fallback path is unbuffered

## Solution (Designed, Not Implemented Yet)

### Redis Queue + Batch Worker
Replace direct `Game.findOne()` per request with a Redis-backed batch pipeline:

```
Request → LPUSH game:fetch:queue { requestId, uuid, timestamp }
           ↓
Worker (polls every 200ms or at BATCH_SIZE=20)
           ↓
Batch: Game.find({ id: { $in: uniqueUuids } })
           ↓
Fan out results: HSET game:fetch:results { requestId } → data
                 PUBLISH game:fetch:result:{requestId}
           ↓
Request receives data via SUBSCRIBE (5s timeout → 504)
```

### Key Features

**UUID Deduplication:**
Multiple requests for the same UUID within the same batch window hit MongoDB once. The worker groups `requestId`s by `uuid`, queries once, and fans out to all subscribers.

**Backpressure:**
When queue exceeds `QUEUE_MAX_LENGTH` (1000), new requests return 503 Service Unavailable.

**Cache Backfill:**
If memory pressure is below 85%, the worker backfills fetched data to Redis (`SET game:{uuid}:nested EX 3600`).

### Parameters
| Parameter | Default | Notes |
|-----------|---------|-------|
| BATCH_SIZE | 20 | Jobs per batch query |
| FLUSH_INTERVAL | 200ms | Max wait before flushing partial batch |
| REQUEST_TIMEOUT | 5s | Max wait for result |
| QUEUE_MAX_LENGTH | 1000 | Backpressure threshold (→ 503) |

### Performance Comparison
| Approach | Latency (p50) | DB Connections | Cost at 10k RPM |
|----------|---------------|----------------|------------------|
| Direct `findOne` | 15-30ms | = concurrent requests | Connection pool saturation |
| Batch queue (20) | 30-60ms | 1-2 | Linear scaling, pool-safe |

## Files to Create/Modify
- `utilities/batchFetchWorker.ts` — Worker loop with batch polling + dedup + fan-out
- `app/api/games/[id]/route.ts` — Replace direct `Game.findOne()` with queue push + result wait
- `lib/queue.ts` — Add `game:fetch:queue` and `game:fetch:results` Redis keys

## Testing
- Batch worker accumulates jobs and flushes at BATCH_SIZE
- Worker flushes at FLUSH_INTERVAL even if batch is partial
- UUID deduplication: N requests for same UUID → 1 MongoDB query
- REQUEST_TIMEOUT returns 504 for orphaned requests
- Backpressure: queue at max returns 503
- Cache backfill skips when memory pressure ≥ 85%

## Verification Checklist
- [ ] LPUSH jobs into `game:fetch:queue`
- [ ] Worker loop with 200ms flush / BATCH_SIZE trigger
- [ ] UUID deduplication (group requestIds, query once)
- [ ] Single `Game.find({ id: { $in } })` per batch
- [ ] Fan out via `HSET` + `PUBLISH` to all waiting requestIds
- [ ] Request-side SUBSCRIBE with 5s timeout → 504 on timeout
- [ ] X-Cache: BATCH header for batch-served responses
- [ ] QUEUE_MAX_LENGTH backpressure → 503
- [ ] Cache backfill when memory < 85%


## Depends On
- [#80](80-GAMEPAGE-CARD-CLICK-NAVIGATION.md)
- [#81](81-GAMEPAGE-BINARY-SEARCH-HOTNESS-CACHE.md)

## Blocks
- [#84](84-GAMEPAGE-FULLGAMERESPONSE-TYPE-UI.md)

## Related Issues
- #80: Card click navigation with sessionStorage preload
- #81: Binary-search hotness cache
- #84: FullGameResponse type and UI components
- #85: Responsive layout and accessibility verification
