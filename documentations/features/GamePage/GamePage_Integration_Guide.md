# GamePage Feature Integration Guide

## Quick Start

### 1. Replace the Existing API Route (Optional)

The current `/api/games/[id]/route.ts` uses basic caching. To use the new hotness cache system:

```bash
# Backup current route
cp app/api/games/[id]/route.ts app/api/games/[id]/route-old.ts

# Use new route (or update current route with hotness cache logic)
cp app/api/games/[id]/route-gamepage.ts app/api/games/[id]/route.ts
```

### 2. Update ProfileCard to Set Preload Data

In `components/adventures/cards/cards.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useGamePreloadStore } from '@/hooks/useGameCache';
import type { GameCardProps } from '@/types/cards';

export function ProfileCard({ id, name, description, image, tags, likes_count }: GameCardProps) {
  const router = useRouter();
  const preloadStore = useGamePreloadStore();

  const handleClick = () => {
    // Store card data in sessionStorage for instant hero render
    preloadStore.setPreload(id, {
      name,
      description,
      image,
      tags: tags || [],
      likes_count: likes_count || 0,
    });

    // Navigate to game page
    router.push(`/game/${id}`);
  };

  return (
    <button onClick={handleClick} className="...">
      {/* Card content */}
    </button>
  );
}
```

### 3. Set Up Batch Processor (Background Worker)

Create `convex/gamePageWorker.ts` or a cron job to process the batch queue:

```typescript
import { processBatch } from '@/utilities/gameFetchPipeline';

// Run every 200ms
export const gamePageBatchWorker = async () => {
  setInterval(() => {
    processBatch().catch((err) => {
      console.error('[GamePageWorker] Error:', err);
    });
  }, 200);
};
```

Or use Next.js API route as cron:

```typescript
// app/api/cron/game-batch-processor/route.ts
import { processBatch } from '@/utilities/gameFetchPipeline';

export async function GET() {
  try {
    await processBatch();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error }, { status: 500 });
  }
}

// In .vercel/cron.json or via Vercel dashboard:
// "*/1 * * * * /api/cron/game-batch-processor"
```

### 4. Environment Setup

Ensure these are in your `.env.local`:

```env
# Redis
redisqueue=redis://...

# Existing
NEXT_PUBLIC_SUPABASE_BUCKET_NAME=deepslate-rpg
CLERK_SECRET_KEY=...
```

### 5. Test the Feature

```bash
# 1. Navigate from ProfileCard to GamePage
# Should see instant hero section with card data

# 2. Wait for full data to load
# Should see characters, maps, items tabs populate

# 3. Click between tabs
# Should be instant (no refetch)

# 4. Check cache stats (dev mode)
# Should show cache entries, memory pressure, queue length
```

## Architecture Overview

### Data Flow

```
ProfileCard onClick
    ↓
setPreload(uuid, cardData)  → sessionStorage
router.push(/game/uuid)
    ↓
GamePage Server (page.tsx)
    ├─ generateMetadata() [lightweight DB fetch]
    └─ Render GameDetailClient + initial props
    ↓
GameDetailClient Client (game-detail.tsx)
    ├─ useGamePreload() → sessionStorage
    │   └─ Render GameHeader instantly
    │
    └─ useGameCache(uuid)
        ├─ Check Redis hotness cache
        ├─ If HIT: Return data + update metrics
        ├─ If MISS: Queue fetch + track hotness
        └─ processBatch() [background]
            ├─ Batch 20 games per 200ms
            ├─ Join PostgreSQL + MongoDB
            └─ Store result in Redis (1 hour TTL)
```

### Cache Tiers

| Tier | Source | Speed | Staleness | Size |
|------|--------|-------|-----------|------|
| 1 | Hotness Cache (Redis) | ~1ms | 0 | ~250KB (1000 entries) |
| 2 | Batch Fetch Queue | ~50-200ms | 0 | Unbounded |
| 3 | Database | ~200-500ms | 0 | Full |

### Hotness Tracking

```
Access 1-4:   SKIP (not promoted)
              ↓ Track in hotnessMap
Access 5:     PROMOTE (if memory OK)
              ↓ Add to cache if space
Cache Entry:  VIEWS = 5
              ↓ Update on hit
Next Hit:     VIEWS += 1
              ↓ Reposition if needed (binary search)
```

### Memory Pressure Handling

When Redis memory ≥ 85%:
- Skip cache reads/writes
- Only track hotness
- Serve from database
- Prevent cache pollution

## Monitoring & Debugging

### Cache Stats (Development)

The GameDetailClient shows cache stats in dev mode:

```
Cache: 234/1000
Memory Pressure: No
Queue Length: 3
```

### Redis Inspection

```bash
# Check cache size
redis-cli STRLEN cache:views:array
redis-cli STRLEN cache:data:array

# Check hotness tracking
redis-cli KEYS "game:hotness:*" | wc -l

# Monitor queue
redis-cli LLEN game:fetch:queue

# View memory usage
redis-cli INFO memory
```

### Logs

- `[HotnessCache]` - Cache operations
- `[GameFetchPipeline]` - Batch operations
- `[useGameCache]` - Hook operations
- `[API /api/games/[id]]` - API route operations

## Performance Characteristics

### Best Case (Cache Hit)
- Time: ~5-10ms
- Includes: Cache lookup + decompression
- No database queries

### Good Case (Cache Miss, Promoted)
- Time: ~150-250ms
- Includes: Batch queue wait + database fetch + compression
- Single batch of 20 games processed together

### Worst Case (Cache Miss, Not Promoted)
- Time: ~200-500ms
- Includes: Direct database fetch
- Happens for games below promotion threshold

### Cache Entry Size
- Average: ~40KB per game (compressed JSON)
- 1000 entries: ~40MB total
- Views array: ~24KB
- Hashmap: ~32KB
- Total overhead: ~56KB + data

## Troubleshooting

### Cache Hit Rate Low
- Check hotness threshold (currently 5)
- Verify Redis memory isn't under pressure
- Check if games are actually being revisited

### Batch Queue Growing
- Increase batch size (currently 20)
- Decrease timeout (currently 200ms)
- Check database performance

### Memory Pressure Alerts
- Reduce `MAX_CACHE_ENTRIES` (currently 1000)
- Implement TTL cleanup
- Check if payload compression is working

## Future Enhancements

1. **Predictive Caching** - Pre-cache related games
2. **Cache Warmup** - Periodic refresh of hot games
3. **Analytics Dashboard** - View cache metrics in real-time
4. **Smart Invalidation** - Detect when data changes and invalidate
5. **Regional Caching** - Redis replication for multi-region
