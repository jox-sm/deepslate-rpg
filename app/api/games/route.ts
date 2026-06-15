import { NextRequest, NextResponse } from 'next/server';
import { getGamesPaginated } from '@/lib/db';
import { getCachedGameIds, warmUpCache } from '@/lib/cache-warmup';
import { redis } from '@/lib/queue';
import { retry } from '@/lib/retry';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';
import { tryApiRoute } from '@/utilities/apiErrorHandler';

let cacheInitialized = false;

async function ensureCachePrimed(): Promise<boolean> {
  if (!cacheInitialized) {
    console.log('[GET /api/games] cache not initialized, attempting warmup...');
    const primed = await retry(() => warmUpCache(), 2, 500).catch(() => {
      console.log('[GET /api/games] warmUpCache threw after retries, treating as false');
      return false;
    });
    cacheInitialized = primed;
    console.log('[GET /api/games] warmUpCache result:', primed, 'cacheInitialized set to:', primed);
    return primed;
  }
  console.log('[GET /api/games] cache already initialized, skipping warmup');
  return true;
}

const LIKES_INTERVAL_MS = 10_000;
const GAMES_INTERVAL_MS = 1_000;
let lastLikesDrain = 0;
let lastGamesDrain = 0;

function maybeTriggerDrain(): void {
  const now = Date.now();
  if (now - lastLikesDrain >= LIKES_INTERVAL_MS) {
    lastLikesDrain = now;
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/drain?target=likes`, {
      method: 'GET',
      headers: { 'x-internal-drain': '1' },
    }).catch(() => { /* drain errors are non-fatal */ });
  }
  if (now - lastGamesDrain >= GAMES_INTERVAL_MS) {
    lastGamesDrain = now;
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/drain?target=games`, {
      method: 'GET',
      headers: { 'x-internal-drain': '1' },
    }).catch(() => { /* drain errors are non-fatal */ });
  }
}

export async function GET(request: NextRequest) {
   const { error } = await validateJWTMiddleware(request);
   if (error) return error;

   try {
     await rateLimitMiddleware(request);
   } catch {
     return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
   }

   return tryApiRoute(async () => {
     maybeTriggerDrain();

      const searchParams = request.nextUrl.searchParams;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
      const offset = (page - 1) * limit;
      console.log('[GET /api/games] params', { page, limit, offset });

      await ensureCachePrimed();

      console.log('[GET /api/games] fetching cached game IDs...');
      const cachedIds = await getCachedGameIds().catch((err) => {
        console.log('[GET /api/games] getCachedGameIds threw:', err);
        return [] as string[];
      });
      const cachedCount = cachedIds.length;
      console.log('[GET /api/games] cachedIds count:', cachedCount);

      if (offset < cachedCount) {
        const endIndex = Math.min(offset + limit, cachedCount);
        const pageIds = cachedIds.slice(offset, endIndex);
        const keys = pageIds.map(id => `game:${id}`);
        console.log('[GET /api/games] fetching from Redis with keys:', keys);
        const values = await redis.mget<string[]>(...keys).catch((err) => {
          console.log('[GET /api/games] redis.mget threw:', err);
          return [] as (string | null)[];
        });
        const filteredResults = values.map(v => {
          if (!v) return null;
          if (typeof v === 'string') return JSON.parse(v);
          return v;
        }).filter(Boolean);
        console.log('[GET /api/games] Redis hits:', filteredResults.length, '/', keys.length);

        if (filteredResults.length > 0) {
          console.log('[GET /api/games] returning Redis-sourced response');
          return NextResponse.json({
            success: true,
            data: filteredResults,
            pagination: { page, limit, total: cachedCount, totalPages: Math.ceil(cachedCount / limit), hasMore: endIndex < cachedCount, source: 'redis' },
          });
        }
        console.log('[GET /api/games] Redis returned no valid data, falling back to PostgreSQL');
      }

      const skip = offset - cachedCount;
      console.log('[GET /api/games] falling back to PostgreSQL, skip:', skip, 'limit:', limit);
      const { games, total } = await retry(() => getGamesPaginated(limit, skip), 3, 500);

     return NextResponse.json({
       success: true,
       data: games,
       pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: offset + limit < total, source: 'postgresql' },
     });
   }, "games");
}