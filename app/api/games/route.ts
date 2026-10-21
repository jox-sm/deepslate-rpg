import { NextRequest, NextResponse } from 'next/server';
import { getGamesPaginated } from '@/lib/db';
import { getCachedGameIds, warmUpCache, mergePendingLikesBatch } from '@/lib/cache-warmup';
import { redis } from '@/lib/queue';
import { retry } from '@/lib/retry';
import { drainGames, drainLikes } from '@/utilities/pull';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';
import { tryApiRoute } from '@/utilities/apiErrorHandler';
import { classifyError, tryOrErrorSync } from '@/utilities/errorHandler';

let cacheInitialized = false;

async function ensureCachePrimed(): Promise<boolean> {
  if (!cacheInitialized) {
    const primed = await retry(() => warmUpCache(), 2, 500).catch((error) => {
      const classified = classifyError(error, "games.ensureCachePrimed");
      console.error('[GET /api/games] warmUpCache threw after retries:', classified.message,
        '| raw:', String(classified.originalError ?? error));
      return false;
    });
    cacheInitialized = primed;
    return primed;
  }
  return true;
}

const LIKES_INTERVAL_MS = 10_000;
const GAMES_INTERVAL_MS = 1_000;
let lastLikesDrain = 0;
let lastGamesDrain = 0;
const drainRunning = new Set<"likes" | "games">();

// Drain in-process instead of self-HTTP-fetching /api/drain: the fetch
// needed NEXT_PUBLIC_APP_URL (unset => "Failed to parse URL") and carried
// no Clerk session (=> 401 at the drain route), so it never worked.
function maybeTriggerDrain(): void {
  const now = Date.now();
  if (now - lastLikesDrain >= LIKES_INTERVAL_MS && !drainRunning.has("likes")) {
    lastLikesDrain = now;
    drainRunning.add("likes");
    drainLikes()
      .catch((error) => {
        const classified = classifyError(error, "games.maybeTriggerDrain.likes");
        console.error('[GET /api/games] drain likes failed:', classified.message,
          '| raw:', String(classified.originalError ?? error));
      })
      .finally(() => drainRunning.delete("likes"));
  }
  if (now - lastGamesDrain >= GAMES_INTERVAL_MS && !drainRunning.has("games")) {
    lastGamesDrain = now;
    drainRunning.add("games");
    drainGames()
      .catch((error) => {
        const classified = classifyError(error, "games.maybeTriggerDrain.games");
        console.error('[GET /api/games] drain games failed:', classified.message,
          '| raw:', String(classified.originalError ?? error));
      })
      .finally(() => drainRunning.delete("games"));
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

      // Fire-and-forget: the handler below already falls back to Postgres
      // when the cache is empty, so awaiting warmup only adds latency
      // (seconds when Redis is down) without changing the response.
      void ensureCachePrimed();

      const cachedIds = await getCachedGameIds().catch((err) => {
        const classified = classifyError(err, "games.getCachedGameIds");
        console.error('[GET /api/games] getCachedGameIds threw:', classified.message);
        return [] as string[];
      });
      const cachedCount = cachedIds.length;

      if (offset < cachedCount) {
        const endIndex = Math.min(offset + limit, cachedCount);
        const pageIds = cachedIds.slice(offset, endIndex);
        const keys = pageIds.map(id => `game:${id}`);
        const values = await retry(() => redis.mget<string[]>(...keys), 3, 500).catch((err) => {
          const classified = classifyError(err, "games.redis.mget");
          console.error('[GET /api/games] redis.mget threw:', classified.message);
          return [] as (string | null)[];
        });
        const filteredResults = values.map(v => {
          if (!v) return null;
          if (typeof v === 'string') {
            const parsed = tryOrErrorSync(() => JSON.parse(v), {
              context: "games.parseCachedGame",
              suppressToast: true,
              suppressComponent: true,
            });
            return parsed.ok ? parsed.data : null;
          }
          return v;
        }).filter(Boolean);

        if (filteredResults.length > 0) {
          const data = await mergePendingLikesBatch(filteredResults);
          return NextResponse.json({
            success: true,
            data,
            pagination: { page, limit, total: cachedCount, totalPages: Math.ceil(cachedCount / limit), hasMore: endIndex < cachedCount, source: 'redis' },
          });
        }
      }

      const skip = offset - cachedCount;
      const { games, total } = await retry(() => getGamesPaginated(limit, skip), 3, 500);
      const data = await mergePendingLikesBatch(games);

     return NextResponse.json({
        success: true,
        data,
       pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: offset + limit < total, source: 'postgresql' },
     });
   }, "games");
}