import { redis } from './queue';
import { getGamesPaginated } from './db';
import { retry } from './retry';
import { classifyError } from '@/utilities/errorHandler';
import { redisWithExponentialRetry } from '@/utilities/hotnessCacheWithRetry';

const CACHE_KEYS = {
  GAME_PREFIX: 'game:',
  GAME_IDS_SET: 'game:ids:all',
  CACHE_PRIMED_FLAG: 'cache:primed:games',
};

const CACHE_TTL = 86400;
const WARMUP_LIMIT = 100;

async function checkCachePrimed(): Promise<boolean> {
  const isPrimed = await redisWithExponentialRetry(
    () => redis.get<string>(CACHE_KEYS.CACHE_PRIMED_FLAG),
    'checkCachePrimed'
  );
  return isPrimed === 'true';
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
  } catch {
    return [];
  }
}

export async function getGameFromCache(id: string): Promise<object | null> {
  const data = await redisWithExponentialRetry(
    () => redis.get<string>(`${CACHE_KEYS.GAME_PREFIX}${id}`),
    `getGameFromCache.${id}`
  );
  if (data) {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    return data as object;
  }
  return null;
}

export async function mergePendingLikes<T extends { likes_count?: number }>(game: T): Promise<T> {
  try {
    const pending = await redis.get<string>(`likes:${(game as any).id}`);
    if (pending) {
      const delta = parseInt(pending, 10);
      if (delta !== 0) {
        return { ...game, likes_count: (game.likes_count ?? 0) + delta };
      }
    }
  } catch {
    // pending-likes read is best-effort
  }
  return game;
}

export async function mergePendingLikesBatch<T extends { likes_count?: number }>(games: T[]): Promise<T[]> {
  try {
    const keys = games.map(g => `likes:${(g as any).id}`);
    console.log('[mergePendingLikesBatch] reading keys:', keys);
    const pendingCounts = await redis.mget<string[]>(...keys).catch(() => [] as (string | null)[]);
    console.log('[mergePendingLikesBatch] raw values:', pendingCounts);
    const merged = games.map((game, i) => {
      const raw = pendingCounts[i];
      if (raw) {
        const delta = parseInt(raw, 10);
        if (delta !== 0) {
          const updated = { ...game, likes_count: (game.likes_count ?? 0) + delta };
          console.log(`[mergePendingLikesBatch] game ${(game as any).id}: ${game.likes_count} -> ${updated.likes_count} (delta: ${delta})`);
          return updated;
        }
      }
      console.log(`[mergePendingLikesBatch] game ${(game as any).id}: no pending like, keeping ${game.likes_count}`);
      return game;
    });
    return merged;
  } catch {
    console.log('[mergePendingLikesBatch] ERROR caught, returning original games');
    return games;
  }
}

export async function setGameInCache(id: string, game: object): Promise<void> {
  const gameData = JSON.stringify(game);
  await Promise.all([
    redisWithExponentialRetry(
      () => redis.set(`${CACHE_KEYS.GAME_PREFIX}${id}`, gameData, { ex: CACHE_TTL }),
      `setGameInCache.${id}`
    ),
    redisWithExponentialRetry(
      () => redis.zadd(CACHE_KEYS.GAME_IDS_SET, { score: Date.now(), member: id }),
      `setGameInCache.zadd.${id}`
    ),
  ]);
}
