import { redis } from './queue';
import { getGamesPaginated } from './db';
import { retry } from './retry';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';

const CACHE_KEYS = {
  GAME_PREFIX: 'game:',
  GAME_IDS_SET: 'game:ids:all',
  CACHE_PRIMED_FLAG: 'cache:primed:games',
};

const CACHE_TTL = 86400;
const WARMUP_LIMIT = 100;

async function checkCachePrimed(): Promise<boolean> {
  const isPrimed = await redis.get<string>(CACHE_KEYS.CACHE_PRIMED_FLAG);
  return isPrimed === 'true';
}

async function setCachePrimed(): Promise<void> {
  await redis.set(CACHE_KEYS.CACHE_PRIMED_FLAG, 'true', { ex: CACHE_TTL });
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

    const operations: Promise<unknown>[] = [];
    const gameIds: string[] = [];

    for (const game of games) {
      const key = `${CACHE_KEYS.GAME_PREFIX}${game.id}`;
      const gameData = JSON.stringify(game);
      operations.push(redis.set(key, gameData, { ex: CACHE_TTL }));
      gameIds.push(game.id);
    }

    if (gameIds.length > 0) {
      operations.push(redis.del(CACHE_KEYS.GAME_IDS_SET));
      for (let i = 0; i < gameIds.length; i++) {
        operations.push(redis.zadd(CACHE_KEYS.GAME_IDS_SET, { score: i + 1, member: gameIds[i] }));
      }
    }

    await Promise.all(operations);
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
  const result = await redis.zrange(CACHE_KEYS.GAME_IDS_SET, 0, -1);
  return (result as string[]) || [];
}

export async function getGameFromCache(id: string): Promise<object | null> {
  const data = await redis.get<string>(`${CACHE_KEYS.GAME_PREFIX}${id}`);
  if (data) {
    const result = tryOrErrorSync(() => JSON.parse(data), { context: `Cache:${id}` });
    if (!result.ok) {
      console.error(`[Cache] Failed to parse cached game: ${id}`);
      return null;
    }
    return result.data;
  }
  return null;
}

export async function setGameInCache(id: string, game: object): Promise<void> {
  const gameData = JSON.stringify(game);
  await Promise.all([
    redis.set(
      `${CACHE_KEYS.GAME_PREFIX}${id}`,
      gameData,
      { ex: CACHE_TTL }
    ),
    redis.zadd(CACHE_KEYS.GAME_IDS_SET, { score: Date.now(), member: id }),
  ]);
}
