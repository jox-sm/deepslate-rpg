# Issue #81: GamePage: Implement binary-search hotness cache

## Status
🔄 OPEN

## Category
Feature, Performance

## Problem Description
Current Redis caching uses unconditional `SET` with static TTL. At scale this approach has two critical flaws:

1. **Cache blow-up** — Every requested game gets cached regardless of popularity, wasting memory on long-tail games that are rarely accessed
2. **Thundering herd** — When TTLs expire simultaneously, multiple requests all miss cache and hammer the database

The feature spec (`documentations/features/GamePage/GamePage.md`) defines a custom in-memory hotness cache using a hashmap + parallel arrays + binary search, replacing the Redis-heavy `SET`/`GET` approach.

## Solution (Designed, Not Implemented Yet)

### Core Data Structures
```
Hashmap (Map<uuid, index>)     → O(1) lookup from uuid to array index
Views Array (sorted by views ▼) → Array<{ views: number, uuid: string }>
Data Array (parallel)           → Array<compressedJson>
```

### Operations

**Cache Hit:**
1. `idx = hashmap.get(uuid)` → O(1)
2. Increment view count
3. Binary search to find new position in sorted views array
4. Splice entry to correct position → O(n), re-index hashmap

**Cache Miss:**
1. Increment hotness map (`Map<uuid, number>`)
2. If hotness < `PROMOTION_THRESHOLD` → skip (game not popular enough)
3. If hotness ≤ barrier entry (lowest cached game's views) → skip
4. Fetch full game data, compress, insert at correct position
5. Evict lowest-viewed game if at capacity

### Memory Bypass
At 85%+ memory pressure, skip cache entirely, only update hotness map, serve directly from DB.

## Why This Design
- **Memory efficient** — ~56 KB overhead for 1000 entries (plus ~40–200 KB payload)
- **CPU cache-friendly** — Binary search only touches small views array entries (number + uuid)
- **Self-healing** — Barrier-to-entry eviction automatically retains only top-N most-viewed games

## Files to Create/Modify
- `lib/hotness-cache.ts` — Cache class with hashmap, views array, data array
- `lib/hotness-cache.test.ts` — Unit tests for binary search, promotion, eviction
- `app/api/games/route.ts` — Integrate hotness cache check before Redis

## Testing
- Binary search correctness (insertion at edges, middle, duplicate views)
- Promotion threshold (games with <5 views never enter cache)
- Barrier-to-entry eviction (lowest-viewed game evicted when full)
- Bypass at 85%+ simulated memory pressure

## Verification Checklist
- [ ] Hashmap → array index O(1) lookup
- [ ] Views array sorted descending by views
- [ ] Binary search for insertion position (O(log n))
- [ ] Splice + re-index for position update (O(n))
- [ ] Barrier-to-entry eviction when at capacity
- [ ] Hotness map tracks pre-cache popularity
- [ ] PROMOTION_THRESHOLD prevents long-tail pollution
- [ ] Memory pressure bypass (85%+ threshold)
- [ ] Integration with existing Redis cache layer


## Depends On
- [#80](80-GAMEPAGE-CARD-CLICK-NAVIGATION.md)

## Blocks
- [#82](82-GAMEPAGE-BATCH-MONGODB-FETCH.md)

## Related Issues
- #80: Card click navigation with sessionStorage preload
- #82: Batch MongoDB fetch via Redis queue
- #84: FullGameResponse type and UI components
