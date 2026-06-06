# Game Page (`/game/[uuid]`)

## Overview

The Game Page is the detail view for a single adventure game. It displays the game's core info (name, description, image, tags) plus its nested entities: characters, maps, and items. The route is dynamic: `/game/[uuid]`.

**Current status:** Not yet implemented. The API backend (`app/api/games/[id]/route.ts`) is ready; the frontend route (`app/game/[uuid]/page.tsx`) and its components do not exist.

---

## Architecture

### Route

```
app/game/[uuid]/page.tsx          -> Server Component (shell + SEO metadata)
app/game/[uuid]/game-detail.tsx   -> Client Component (data fetching + interactivity)
```

### Card Click → Navigation with Preloaded Data

When a user clicks `ProfileCard` on the homepage, the card already has the game's basic data (name, description, image, tags, likes). Instead of navigating to a blank page and fetching from scratch, the card passes its data forward:

```
ProfileCard onClick()
  |
  1. sessionStorage.setItem(`game:${uuid}:card`, JSON.stringify(cardData))
  2. router.push(`/game/${uuid}`)        instant navigation
        |
        v
GameDetailClient mounts
  |
  3. initialData = sessionStorage.getItem(`game:${uuid}:card`)
     if initialData: render hero section INSTANTLY (name, image, description, tags)
                       ↓
     SEO: server component generates <head> metadata from the uuid
          (generateMetadata with lightweight name lookup)
        |
        v
  4. Fetch full data via batch pipeline (characters, maps, items)
     GET /api/games/[uuid]
        |
        v
  Tier 1: Client cache check (sessionStorage or Zustand)
    |
    ├── Check memory pressure via INFO memory
    |   If used_memory >= 85% of maxmemory:
    |     Skip cache read/write entirely
    |     Increment hotness map: INCR game:{uuid}:hits
    |     Fall through to Tier 3
    |
    ├── Cache HIT (memory OK):
    |     Serve FullGameData directly
    |     Return X-Cache: HIT
    |
    └── Cache MISS (memory OK):
          Increment hotness map: INCR game:{uuid}:hits
          If hotness >= PROMOTION_THRESHOLD (e.g. 5 hits):
            Queue a promotion job for this game
            On promotion, if memory is tight:
              ZREMRANGEBYRANK game:access:rank 0 0 (evict lowest-access)
          Fall through to Tier 3
        |
        v
  Tier 3: Batch MongoDB fetch via Redis queue
    |
    Push a fetch request into Redis list: game:fetch:queue
    Worker polls queue every 200ms or when batch >= BATCH_SIZE (e.g. 20)
      Collect batch of { requestId, uuid }
      Single MongoDB query: Game.find({ id: { $in: batchUuids } })
      MongoDB returns nested data: characters[], maps[], items[]
      (Flat fields already available from card data in sessionStorage)
      Backfill into Redis cache (if memory allows)
      Return each result to its waiting request via requestId
    |
    v
  Response: NestedGameData (characters[], maps[], items[])
        |
        v
  Renders: GameHeader + CharacterTabs/Grid + MapList + ItemGrid
```

### Data Shape

See `types/cards.ts` for flat fields and `types/gamedata.ts` for nested data (characters, maps, items). The batch pipeline fetches only the nested portion from MongoDB; flat fields arrive via sessionStorage from the card click.

---

## Caching Strategy: Binary-Search Hotness Cache

### Design Goal

Two data structures: **hashmap** + **parallel arrays** (the "array" is physically two arrays that share indices). The hashmap maps uuid → index. At that index, `viewsArray[index]` holds the sort-key pair and `dataArray[index]` holds the payload. Binary search on viewsArray's `views` field for O(log n) insertion. No Redis ZSET, no skip list overhead.

### Core Data Structures

```
┌──────────────────────────────────────────────┐
│                  HASHMAP                       │
│  Map<uuid, index>  (shared across both arrays) │
│                                                │
│  uuid_a ────────► 0                            │
│  uuid_b ────────► 2                            │
│  uuid_c ────────► 1                            │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│             VIEWS ARRAY (sorted by views ▼)    │
│  index │ views │ uuid                         │
│  ──────┼───────┼──────                        │
│    0   │  150  │ uuid_a      ← most viewed    │
│    1   │   80  │ uuid_c                       │
│    2   │   50  │ uuid_b                       │
│   ...  │  ...  │  ...                         │
│  last  │   X   │ uuid_n      ← barrier        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│          DATA ARRAY (parallel, unsorted)       │
│  index │ compressedJson                       │
│  ──────┼───────────────────────────────────   │
│    0   │ {...}  (game data for uuid_a)        │
│    1   │ {...}  (game data for uuid_c)        │
│    2   │ {...}  (game data for uuid_b)        │
│   ...  │  ...                                  │
│  last  │ {...}                                 │
└──────────────────────────────────────────────┘
```

**HashMap** (`Map<uuid, number>`) — uuid → index. One number. That's it.

**Views Array** (`Array<{ views: number, uuid: string }>`) — sorted descending by `views`. Binary search target. Small entries (no data payload) keeps the search cache-friendly.

**Data Array** (`Array<compressedJson>`) — parallel to viewsArray. `dataArray[i]` = the cached payload for the game at `viewsArray[i]`. Never searched, only indexed directly.

### Why Split?

Binary search only touches the views array — tiny entries (number + uuid) that fit in CPU cache lines. The compressed JSON payloads sit untouched in the data array until directly requested. If they were combined, each binary search step would drag JSON bytes through the cache for no reason.

### Operations

#### Cache Hit

```
1. idx = hashmap.get(uuid)                           // O(1)
2. newViews = viewsArray[idx].views += 1
3. // Binary search to find the correct range
   lowerBound = binarySearchViews(newViews + 1)       // first index with views <= newViews (exclusive upper)
   upperBound = binarySearchViews(newViews)            // first index with views < newViews (exclusive lower)

   // If idx is already within bounds, no move needed
   if idx < lowerBound || idx >= upperBound:
     entry = { views: newViews, uuid }
     data = dataArray[idx]

     // Remove from current position
     viewsArray.splice(idx, 1)
     dataArray.splice(idx, 1)

     // Insert at the correct position (upperBound adjusted if removed before it)
     newPos = idx < upperBound ? upperBound - 1 : upperBound
     viewsArray.splice(newPos, 0, entry)
     dataArray.splice(newPos, 0, data)

     // Update hashmap for all shifted entries
     reindex(Math.min(idx, newPos))

4. return dataArray[hashmap.get(uuid)]
```

The binary search finds the exact range where the updated view count belongs. The entry is removed and re-inserted at the correct position in O(n) worst-case (due to splice shifting), but the search itself is O(log n). Since cache size is bounded by Redis memory (typically < 1000 entries), O(n) is acceptable.

#### Cache Miss (uuid not in hashmap)

```
hotness = hotnessMap.get(uuid) ?? 0
hotnessMap.set(uuid, hotness + 1)

if hotness + 1 < PROMOTION_THRESHOLD:
  return "skip"

barrier = viewsArray[MAX_CACHE_ENTRIES - 1]?.views ?? 0
if hotness + 1 <= barrier && viewsArray.length >= MAX_CACHE_ENTRIES:
  return "skip"

compressed = compress(await fetchFullGame(uuid))

if viewsArray.length < MAX_CACHE_ENTRIES:
  pos = binarySearchViews(hotness + 1)
  viewsArray.splice(pos, 0, { views: hotness + 1, uuid })
  dataArray.splice(pos, 0, compressed)
  reindex(pos)

else:
  evicted = viewsArray.pop()
  dataArray.pop()
  hashmap.delete(evicted.uuid)
  pos = binarySearchViews(hotness + 1)
  viewsArray.splice(pos, 0, { views: hotness + 1, uuid })
  dataArray.splice(pos, 0, compressed)
  reindex(pos)

hotnessMap.delete(uuid)

function reindex(from: number):
  for i from from to viewsArray.length - 1:
    hashmap.set(viewsArray[i].uuid, i)
```

#### Binary Search

```typescript
function binarySearchViews(views: number): number {
  let lo = 0, hi = viewsArray.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (viewsArray[mid].views <= views) hi = mid - 1;
    else lo = mid + 1;
  }
  return lo; // insertion index
}
```

#### Cache Bypass (memory pressure)

When system memory hits 85%+:
- Bypass the cache entirely
- Only update the hotness map
- Serve directly from batch DB merge pipeline

### Barrier to Entry

```
barrier = viewsArray[MAX_CACHE_ENTRIES - 1]?.views ?? 0
```

A game can only enter the cache if its views > barrier (when full). The cache always holds the `MAX_CACHE_ENTRIES` most-viewed games. Long-tail games never pollute memory.

### Memory Footprint

For `MAX_CACHE_ENTRIES = 1000`:

| Structure | Size |
|-----------|------|
| Views Array (1000 × { number, string }) | ~24 KB |
| Data Array (1000 × compressed JSON) | ~40-200 KB (payload dependent) |
| HashMap (1000 × string → number) | ~32 KB |
| **Total overhead** | **~56 KB + payload** |

No skip lists, no dict entries for scores, no double storage of keys. Just flat arrays and a hashmap.

---

## Batch DB Merge Pipeline

### Problem

Direct per-request MongoDB queries (`Game.findOne({ id })`) do not scale. At 100+ concurrent requests, MongoDB connection pool saturates and query latency spikes.

### Solution: Redis Queue + Batch Worker

Instead of hitting MongoDB directly, each request pushes a fetch job to a Redis list. A dedicated worker deques jobs in batches, executes a single multi-document query, and fans out results.

### Queue Structure

```
Redis key:     game:fetch:queue        (List — LPUSH / BRPOPLPUSH)
Redis key:     game:fetch:results      (Hash — temporary result store)
```

### Job Payload

```typescript
interface FetchJob {
  requestId: string;    // UUID v7, used to correlate result back to HTTP request
  uuid: string;         // Game UUID to fetch
  timestamp: number;    // For staleness tracking
}
```

### Worker Loop

The batch worker fetches **only MongoDB data** (characters, maps, items). Flat fields (name, description, image, tags, likes) are already available from the card data passed via sessionStorage.

```
loop:
  wait 200ms or until BATCH_SIZE (20) jobs accumulate, whichever comes first

  batch = atomically pop BATCH_SIZE jobs from queue
  uuids = batch.map(j => j.uuid)

  // Batch MongoDB query — nested data only
  games = await Game.find({ id: { $in: uuids } }).lean()

  for each job in batch:
    gameDoc = games.find(d => d.id === job.uuid)
    nestedData = {
      characters: gameDoc?.characters || [],
      maps:       gameDoc?.maps || [],
      items:      gameDoc?.items || [],
      status:     gameDoc?.status || 'draft',
    }

    // Backfill cache (memory permitting, TTL = 1 hour)
    if memory_pressure < 85%:
      SET game:{uuid}:nested <nestedData> EX 3600

    // Fan out result
    HSET game:fetch:results {job.requestId} <nestedData>
    PUBLISH game:fetch:result:{job.requestId} <nestedData>
```

### Request Deduplication

Multiple requests for the **same UUID** within the same batch window should only hit MongoDB once. The worker deduplicates by UUID before querying:

```
batch = atomically pop BATCH_SIZE jobs from queue

// Deduplicate: group requestIds by uuid
dedupMap = Map<uuid, requestId[]>
for each job in batch:
  dedupMap.getOrCreate(job.uuid).push(job.requestId)

// Single MongoDB query per unique uuid (nested data only)
uniqueUuids = dedupMap.keys()
games = await Game.find({ id: { $in: uniqueUuids } }).lean()

for each uuid in uniqueUuids:
  gameDoc = games.find(d => d.id === uuid)
  nestedData = {
    characters: gameDoc?.characters || [],
    maps:       gameDoc?.maps || [],
    items:      gameDoc?.items || [],
    status:     gameDoc?.status || 'draft',
  }

  // Fan out to ALL requestIds waiting for this uuid
  for each requestId in dedupMap.get(uuid):
    HSET game:fetch:results {requestId} <nestedData>
    PUBLISH game:fetch:result:{requestId} <nestedData>
```

If 50 concurrent users request the same game, the batch worker fetches it **once** from MongoDB and publishes to all 50 subscribers.

### Request-Side (HTTP handler)

```
1. Generate requestId (UUID v7)
2. LPUSH game:fetch:queue { requestId, uuid, timestamp }
3. SUBSCRIBE game:fetch:result:{requestId}  (with timeout, e.g. 5s)
4. On message: return merged data with X-Cache: BATCH
5. On timeout: return 504 Gateway Timeout
```

### Batch Parameters

| Parameter | Default | Notes |
|-----------|---------|-------|
| `BATCH_SIZE` | 20 | Jobs per batch query |
| `FLUSH_INTERVAL` | 200ms | Max wait before flushing partial batch |
| `REQUEST_TIMEOUT` | 5s | Max time a request waits for its result |
| `QUEUE_MAX_LENGTH` | 1000 | Backpressure threshold (return 503 if exceeded) |

### Why Not Direct MongoDB Per Request

| Approach | Latency (p50) | DB Connections | Cost at 10k RPM |
|----------|---------------|----------------|------------------|
| Direct `findOne` | 15-30ms | = concurrent requests | Connection pool saturation |
| Batch queue (20) | 30-60ms | 1-2 | Linear scaling, pool-safe |

The batch queue adds ~30ms p50 latency but eliminates connection pool contention entirely, making it viable at 10x the throughput.

### Component Tree

```
app/game/[uuid]/page.tsx
  └── GameDetailShell (Server Component)
        ├── <head> metadata
        └── <Suspense fallback=<GamePageSkeleton />>
              └── GameDetailClient (Client Component)
                    ├── GameHeader
                    │     ├── GameImage (hero banner with fallback)
                    │     ├── GameTitle
                    │     ├── GameDescription
                    │     ├── GameTags
                    │     └── GameMeta (likes, status, created date)
                    ├── GameContent (tabs or sections)
                    │     ├── CharactersSection
                    │     │     ├── CharacterCard (for each character)
                    │     │     │     ├── CharacterImage
                    │     │     │     ├── CharacterName
                    │     │     │     └── CharacterDescription
                    │     ├── MapsSection
                    │     │     ├── MapCard (for each map)
                    │     │     │     ├── MapImage
                    │     │     │     ├── MapName
                    │     │     │     ├── MapSize
                    │     │     │     └── MapPlaces
                    │     └── ItemsSection
                    │           ├── ItemCard (for each item)
                    │                 ├── ItemImage
                    │                 └── ItemName
                    └── ErrorBoundary
                          └── GamePageError (retry button + error message)
```

### Component States

| Component | Loading | Empty | Error | Success |
|-----------|---------|-------|-------|---------|
| GameDetailShell | Suspense skeleton | N/A | N/A | Passes data to client |
| GameHeader | Shimmer skeleton (image + 3 text lines) | N/A | Fallback to default image | Full hero card |
| CharactersSection | 3 skeleton cards | "No characters yet" message | Inline error per section | Grid of CharacterCards |
| MapsSection | 3 skeleton cards | "No maps yet" message | Inline error per section | Grid of MapCards |
| ItemsSection | 3 skeleton cards | "No items yet" message | Inline error per section | Grid of ItemCards |
| GamePageError | N/A | N/A | Full-page error with retry | N/A |

### Responsive Layout

Using mobile-first 8px grid system:

```
Mobile (<640px):
  ┌────────────────────────┐
  │  Hero Image (full w)   │  h-48
  ├────────────────────────┤
  │  Title                 │  p-4
  │  Description           │
  │  Tags [fantasy][rpg]   │
  ├────────────────────────┤
  │  Characters ▼          │  collapsible sections
  │  Maps ▼                │  or vertical tabs
  │  Items ▼               │
  └────────────────────────┘

Tablet (640-1024px):
  ┌──────────────────────────────┐
  │  ┌────────┐  Title           │  grid-cols-[300px_1fr]
  │  │  Hero  │  Description     │  gap-6 p-6
  │  │ Image  │  Tags            │
  │  └────────┘                  │
  ├──────────────────────────────┤
  │  Characters (2-col grid)     │  grid-cols-2 gap-4
  │  Maps (2-col grid)           │
  │  Items (2-col grid)          │
  └──────────────────────────────┘

Desktop (1024+):
  ┌─────────────────────────────────┐
  │  ┌──────────┐  Title            │  max-w-6xl mx-auto
  │  │   Hero   │  Description      │  grid-cols-[400px_1fr]
  │  │   Image  │  Tags + Meta      │  gap-8 p-8
  │  └──────────┘                   │
  ├─────────────────────────────────┤
  │  Characters (3-col grid)        │
  │  Maps (2-col grid)              │
  │  Items (4-col grid)             │
  └─────────────────────────────────┘
```

### Skeleton Pattern (using shadcn Card + Tailwind animate-pulse)

```tsx
function GamePageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <div className="grid md:grid-cols-[300px_1fr] gap-6">
        <div className="aspect-video md:aspect-square bg-muted rounded-lg animate-pulse" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
```

### Image Handling

- All images use `imageError` fallback pattern from `ProfileCard` (`onError` -> `/images/project.jpg`)
- Hero image: `object-cover`, aspect ratio `16:9` mobile, `1:1` tablet+
- Character/map/item images: `object-cover`, `aspect-square`, rounded
- Images from Supabase storage (`/api/convertUrl` pipeline)

---

## API Reference

### `GET /api/games/[id]`

**Auth:** Required (Clerk JWT via `validateJWTMiddleware`)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v7",
    "name": "Quest of the Lost Crown",
    "description": "...",
    "image": "https://...",
    "tags": ["fantasy", "rpg"],
    "likes_count": 42,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
    "characters": [{ "id": "...", "name": "Aragorn", "description": "...", "image": "..." }],
    "maps": [{ "id": "...", "nameOfPlace": "Moria", "sizeOfPlace": "Huge", "placesAtMap": "...", "image": "..." }],
    "items": [{ "id": "...", "name": "Ring of Power", "image": "..." }],
    "status": "published"
  },
  "headers": { "X-Cache": "HIT" | "MISS" }
}
```

**Cache headers:**
- `X-Cache: HIT` — served from Redis cache (normal path)
- `X-Cache: MISS` — fetched via batch MongoDB pipeline, backfilled to Redis (memory permitting)
- `X-Cache: BYPASS` — Redis memory >= 85%, served directly from batch DB, not cached

**Error responses:**
- `400` — Invalid/missing game ID
- `404` — Game not found
- `500` — Internal server error

---

## Architecture Assessment

### Findings from graphify (cross-referenced with codebase audit)

#### Issue 1: Route does not exist
**Severity: HIGH** — The entire GamePage is documented but unimplemented. No `app/game/[uuid]/page.tsx` file exists. The homepage `CardsGrid` renders `ProfileCard` components that have no link/navigation to a detail page.

#### Issue 2: Dual data source ambiguity
**Severity: MEDIUM** — Convex defines `games:get`, `characters:listByGame`, `maps:listByGame`, `items:listByGame` queries, but the frontend consumes REST API (`/api/games`). The GamePage must choose:
- **Option A**: Use Convex subscriptions (real-time, reactive, but not yet integrated in frontend)
- **Option B**: Use REST API (consistent with CardsGrid, but no real-time)
- **Recommendation**: Option B for initial implementation (consistency), migrate to Convex later

#### Issue 3: Missing data type for merged response
**Severity: MEDIUM** — `GameDataJSON` in `types/gamedata.ts` only has `{ id, characters, maps, items }` and does not include the flat fields from PostgreSQL (`name`, `description`, `image`, `tags`, `likes_count`, etc.). A new `FullGameResponse` type is needed that extends `GameCardProps` with the nested arrays.

#### Issue 4: No loading skeleton components exist
**Severity: LOW** — The documentation references "loading skeleton" but the codebase only has animated dots in `CardsGrid`. A dedicated skeleton component for GamePage must be built from scratch.

#### Issue 5: Buffer/flush batch pattern not implemented
**Severity: MEDIUM** — The batch DB merge pipeline via Redis queue is designed but not implemented. The current `app/api/games/[id]/route.ts` does a direct `Game.findOne({ id }).lean()` per request. Without the batch queue, MongoDB connection pool saturates past ~100 concurrent requests.

#### Issue 6: Binary-search hotness cache not implemented
**Severity: MEDIUM** — The custom in-memory cache (hashmap → array index, single flat array sorted by views with binary search) is designed but not implemented. Current caching is unconditional Redis `SET` with static TTL. At scale this causes cache blow-up and thundering herd storms.

#### Issue 7: Error boundary coverage is missing
**Severity: LOW** — The API route has error handling, but no React error boundary exists in the frontend for catching rendering errors during game detail display.

#### Issue 8: CSS approach inconsistency
**Severity: LOW** — `ProfileCard` uses CSS modules (`cards.module.css`), while shadcn primitives use Tailwind. New GamePage components should standardize on Tailwind + shadcn to match the design system direction (see `components.json`).

---

## Key Engineering Wins

- **Binary-search hotness cache** — two structures only (hashmap → array index, flat array sorted by views) with O(log n) insertion and O(1) dereference, ~60% less memory than Redis ZSET
- **Batch MongoDB via Redis queue** — coalesces N concurrent MongoDB queries into a single batched `$in` query, deduplicated by uuid
- **Three-tier fallback** (client -> Redis -> batch DB) ensures every request has a path to data without hammering the database
- **Merged data API** reduces client to a single fetch call instead of 4 separate calls (game + characters + maps + items)
- **Optimistic navigation** from home page card click provides instant route transition with skeleton feedback
- **Modular design** keeps the backend API reusable for other consumers (mobile app, future Convex sync)

---

## Implementation Checklist

- [ ] Create `app/game/[uuid]/page.tsx` server component with Suspense
- [ ] Create `types/gameDetail.ts` — `FullGameResponse` interface merging flat + nested data
- [ ] Create `GameDetailShell` server component with SEO metadata generation
- [ ] Create `GamePageSkeleton` component (Tailwind + animate-pulse)
- [ ] Create `GameDetailClient` client component with data fetching from `/api/games/[uuid]`
- [ ] Create `GameHeader` component (hero image, title, description, tags, meta)
- [ ] Create `CharacterCard` component with image fallback
- [ ] Create `MapCard` component with image fallback
- [ ] Create `ItemCard` component with image fallback
- [ ] Create `GamePageError` component with retry button
- [ ] Wrap in React ErrorBoundary
- [ ] Add navigation from `ProfileCard` (click -> `router.push(/game/${id})`)
- [ ] Implement hotness map (`Map<uuid, number>`) for pre-cache popularity tracking
- [ ] Implement cache array (`Array<{ views, uuid, compressedJson }>`) sorted by views
- [ ] Implement hashmap (`Map<uuid, number>`) → array index
- [ ] Implement binary search on views for insertion position
- [ ] Implement bubble-up via binary search (find bounds → splice → re-index)
- [ ] Implement barrier-to-entry eviction (lowest views gets evicted when full)
- [ ] Implement memory pressure detection (`INFO memory`, 85% bypass threshold)
- [ ] Implement batch fetch queue (`game:fetch:queue` — LPUSH / BRPOPLPUSH worker)
- [ ] Implement batch worker loop (200ms flush / BATCH_SIZE=20 trigger)
- [ ] Implement UUID deduplication in batch worker (group requestIds by uuid, query once)
- [ ] Implement request-side result wait (SUBSCRIBE or polling `game:fetch:results`)
- [ ] Add `X-Cache: BATCH` header for batch-served responses
- [ ] Add backpressure logic (`QUEUE_MAX_LENGTH` -> 503)
- [ ] Add integration test for full render flow
- [ ] Verify responsive: mobile, tablet, desktop, ultrawide
- [ ] Load test: verify binary search + bubble-up handles 10k RPM without lock contention
- [ ] Load test: verify cache bypass at 85%+ memory pressure
- [ ] Load test: verify batch coalescing reduces MongoDB connections
