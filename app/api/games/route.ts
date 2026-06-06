import { NextRequest, NextResponse } from 'next/server';
import { getGamesPaginated } from '@/lib/db';
import { getCachedGameIds, warmUpCache } from '@/lib/cache-warmup';
import { redis } from '@/lib/queue';
import { retry } from '@/lib/retry';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';
import { tryApiRoute, handleApiRouteError } from '@/utilities/apiErrorHandler';

let cacheInitialized = false;

async function ensureCachePrimed(): Promise<void> {
  if (!cacheInitialized) {
    await retry(() => warmUpCache(), 2, 500);
    cacheInitialized = true;
  }
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

     await ensureCachePrimed();

     const cachedIds = await retry(() => getCachedGameIds(), 3, 500);
     const cachedCount = cachedIds.length;

     if (offset < cachedCount) {
       const endIndex = Math.min(offset + limit, cachedCount);
       const pageIds = cachedIds.slice(offset, endIndex);
       const keys = pageIds.map(id => `game:${id}`);
        const values = await retry(() => redis.mget<string[]>(...keys), 3, 500);
       const filteredResults = values.map(v => v ? JSON.parse(v) : null).filter(Boolean);

       return NextResponse.json({
         success: true,
         data: filteredResults,
         pagination: { page, limit, total: cachedCount, totalPages: Math.ceil(cachedCount / limit), hasMore: endIndex < cachedCount, source: 'redis' },
       });
     }

     const skip = offset - cachedCount;
     const { games, total } = await retry(() => getGamesPaginated(limit, skip), 3, 500);

     return NextResponse.json({
       success: true,
       data: games,
       pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: offset + limit < total, source: 'postgresql' },
     });
   }, "games");
}