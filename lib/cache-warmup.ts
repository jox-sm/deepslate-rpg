import { redis } from './queue';
import { getGamesPaginated } from './db';

const CACHE_KEYS = {
  GAME_PREFIX: 'game:',
  GAME_IDS_SET: 'game:ids:all',
  CACHE_PRIMED_FLAG: 'cache:primed:games',
};

const CACHE_TTL = 86400;
const WARMUP_LIMIT = 100;

async function checkCachePrimed(): Promise<boolean> {
  const isPrimed = await redis.get(CACHE_KEYS.CACHE_PRIMED_FLAG);
  return isPrimed === 'true';
}

async function setCachePrimed(): Promise<void> {
  await redis.set(CACHE_KEYS.CACHE_PRIMED_FLAG, 'true', 'EX', CACHE_TTL);
}

export async function warmUpCache(): Promise<boolean> {
  try {
    const isPrimed = await checkCachePrimed();
    if (isPrimed) {
      console.log('[CacheWarmup] Cache already primed, skipping warm-up');
      return false;
    }

    console.log('[CacheWarmup] Starting cache warm-up...');

    const { games } = await getGamesPaginated(WARMUP_LIMIT, 0);

    if (games.length === 0) {
      console.log('[CacheWarmup] No games found in PostgreSQL');
      await setCachePrimed();
      return false;
    }

    const pipeline = redis.pipeline();
    const gameIds: string[] = [];

    for (const game of games) {
      const key = `${CACHE_KEYS.GAME_PREFIX}${game.id}`;
      const gameData = JSON.stringify(game);
      pipeline.set(key, gameData, 'EX', CACHE_TTL);
      gameIds.push(game.id);
    }

    if (gameIds.length > 0) {
      pipeline.del(CACHE_KEYS.GAME_IDS_SET);
      for (let i = 0; i < gameIds.length; i++) {
        pipeline.zadd(CACHE_KEYS.GAME_IDS_SET, i + 1, gameIds[i]);
      }
    }

    await pipeline.exec();
    await setCachePrimed();

    console.log(`[CacheWarmup] Successfully cached ${games.length} games`);
    return true;
  } catch (error) {
    console.error('[CacheWarmup] Error during warm-up:', error);
    return false;
  }
}

export async function getCachedGameIds(): Promise<string[]> {
  return redis.zrange(CACHE_KEYS.GAME_IDS_SET, 0, -1);
}

export async function getGameFromCache(id: string): Promise<object | null> {
  const data = await redis.get(`${CACHE_KEYS.GAME_PREFIX}${id}`);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      console.error(`[Cache] Failed to parse cached game: ${id}`);
      return null;
    }
  }
  return null;
}

export async function setGameInCache(id: string, game: object): Promise<void> {
  const gameData = JSON.stringify(game);
  await Promise.all([
    redis.set(
      `${CACHE_KEYS.GAME_PREFIX}${id}`,
      gameData,
      'EX',
      CACHE_TTL
    ),
    redis.zadd(CACHE_KEYS.GAME_IDS_SET, Date.now(), id),
  ]);
}