import { redis } from './queue';
import { getGamesPaginated } from './db';
import { retry } from './retry';
import { classifyError, tryOrErrorSync } from '@/utilities/errorHandler';
import { redisWithExponentialRetry } from '@/utilities/hotnessCacheWithRetry';

const CACHE_KEYS = {
  GAME_PREFIX: 'game:',
  GAME_IDS_SET: 'game:ids:all',
  CACHE_PRIMED_FLAG: 'cache:primed:games',
};

const CACHE_TTL = 86400;
const WARMUP_LIMIT = 100;

/**
 * The Upstash SDK auto-deserializes JSON on GET. A value written as the
 * string 'true' comes back as the BOOLEAN `true`, so a strict `=== 'true'`
 * comparison never matches: the primed flag was set correctly but the check
 * always reported "not primed", which made warmUpCache() re-run on every
 * single request (and every 60s from the cacheWarmup worker).
 *
 * Accept every representation the flag can round-trip through.
 */
function isPrimedFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value === 1;
  return false;
}

async function checkCachePrimed(): Promise<boolean> {
  const isPrimed = await redisWithExponentialRetry(
    () => redis.get(CACHE_KEYS.CACHE_PRIMED_FLAG),
    'checkCachePrimed'
  );
  return isPrimedFlag(isPrimed);
}

async function setCachePrimed(): Promise<void> {
  await redisWithExponentialRetry(
    () => redis.set(CACHE_KEYS.CACHE_PRIMED_FLAG, 'true', { ex: CACHE_TTL }),
    'setCachePrimed'
  );
}

export async function warmUpCache(): Promise<boolean> {
  try {
    const isPrimed = await checkCachePrimed();
    if (isPrimed) {
      console.log('[CacheWarmup] Cache already primed, skipping warm-up');
      return false;
    }

    console.log('[CacheWarmup] Starting cache warm-up...');

    const { games } = await retry(() => getGamesPaginated(WARMUP_LIMIT, 0), 3, 1000);

    if (games.length === 0) {
      console.log('[CacheWarmup] No games found in PostgreSQL');
      await setCachePrimed();
      return false;
    }

    const gameIds: string[] = [];
    const p = redis.pipeline();

    for (const game of games) {
      p.set(`${CACHE_KEYS.GAME_PREFIX}${game.id}`, JSON.stringify(game), { ex: CACHE_TTL });
      gameIds.push(game.id);
    }

    if (gameIds.length > 0) {
      p.del(CACHE_KEYS.GAME_IDS_SET);
      for (let i = 0; i < gameIds.length; i++) {
        p.zadd(CACHE_KEYS.GAME_IDS_SET, { score: i + 1, member: gameIds[i] });
      }
    }

    await p.exec();
    await setCachePrimed();

    console.log(`[CacheWarmup] Successfully cached ${games.length} games`);
    return true;
  } catch (error) {
    const classified = classifyError(error, "CacheWarmup.warmUpCache");
    console.error('[CacheWarmup] Error during warm-up:', classified.message);
    return false;
  }
}

export async function getCachedGameIds(): Promise<string[]> {
  try {
    const result = await redisWithExponentialRetry(
      () => redis.zrange(CACHE_KEYS.GAME_IDS_SET, 0, -1),
      'getCachedGameIds'
    );
    return (result as string[]) || [];
  } catch (error) {
    const classified = classifyError(error, "CacheWarmup.getCachedGameIds");
    console.error('[CacheWarmup] getCachedGameIds failed:', classified.message);
    return [];
  }
}

export async function getGameFromCache(id: string): Promise<object | null> {
  try {
    const data = await redisWithExponentialRetry(
      () => redis.get<string>(`${CACHE_KEYS.GAME_PREFIX}${id}`),
      `getGameFromCache.${id}`
    );
    if (data) {
      if (typeof data === 'string') {
        const parsed = tryOrErrorSync(() => JSON.parse(data), {
          context: `CacheWarmup.getGameFromCache.${id}`,
          suppressToast: true,
          suppressComponent: true,
        });
        return parsed.ok ? (parsed.data as object) : null;
      }
      return data as object;
    }
    return null;
  } catch (error) {
    const classified = classifyError(error, `CacheWarmup.getGameFromCache.${id}`);
    console.error('[CacheWarmup] getGameFromCache failed:', classified.message);
    return null;
  }
}

export async function mergePendingLikes<T extends { likes_count?: number; id?: string | number }>(game: T): Promise<T> {
  try {
    const pending = await redisWithExponentialRetry(
      () => redis.get<string>(`likes:${game.id}`),
      `mergePendingLikes.${game.id}`
    );
    if (pending) {
      const delta = parseInt(pending, 10);
      if (Number.isFinite(delta) && delta !== 0) {
        return { ...game, likes_count: (game.likes_count ?? 0) + delta };
      }
    }
  } catch (error) {
    const classified = classifyError(error, `CacheWarmup.mergePendingLikes.${game.id}`);
    console.error('[CacheWarmup] mergePendingLikes failed:', classified.message);
  }
  return game;
}

export async function mergePendingLikesBatch<T extends { likes_count?: number; id?: string | number }>(games: T[]): Promise<T[]> {
  try {
    const keys = games.map(g => `likes:${g.id}`);
    const pendingCounts = await redisWithExponentialRetry(
      () => redis.mget<string[]>(...keys),
      'mergePendingLikesBatch'
    ).catch((error) => {
      const classified = classifyError(error, "CacheWarmup.mergePendingLikesBatch.mget");
      console.error('[CacheWarmup] mget failed:', classified.message);
      return [] as (string | null)[];
    });
    const merged = games.map((game, i) => {
      const raw = pendingCounts[i];
      if (raw) {
        const delta = parseInt(raw, 10);
        if (Number.isFinite(delta) && delta !== 0) {
          const updated = { ...game, likes_count: (game.likes_count ?? 0) + delta };
          return updated;
        }
      }
      return game;
    });
    return merged;
  } catch (error) {
    const classified = classifyError(error, "CacheWarmup.mergePendingLikesBatch");
    console.error('[CacheWarmup] mergePendingLikesBatch failed:', classified.message);
    return games;
  }
}

export async function setGameInCache(id: string, game: object): Promise<void> {
  const gameData = JSON.stringify(game);
  // The index set is ordered by score and read with ZRANGE (ascending), so the
  // score is a display rank. The warm-up writes ranks 1..N in Postgres order;
  // writing Date.now() here mixed epoch millis into the same key and dragged an
  // already-listed game to the end of the list on every detail-page view.
  // Append after the current tail instead, and use NX so a member that is
  // already indexed keeps the rank it has.
  const size = await redisWithExponentialRetry(
    () => redis.zcard(CACHE_KEYS.GAME_IDS_SET),
    `setGameInCache.zcard`
  ).catch(() => 0);
  await Promise.all([
    redisWithExponentialRetry(
      () => redis.set(`${CACHE_KEYS.GAME_PREFIX}${id}`, gameData, { ex: CACHE_TTL }),
      `setGameInCache.${id}`
    ),
    redisWithExponentialRetry(
      () => redis.zadd(CACHE_KEYS.GAME_IDS_SET, { nx: true }, { score: size + 1, member: id }),
      `setGameInCache.zadd.${id}`
    ),
  ]);
}
