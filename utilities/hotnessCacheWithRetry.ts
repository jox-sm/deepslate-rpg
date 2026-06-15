import { redis } from '@/lib/queue';
import { classifyError } from '@/utilities/errorHandler';
import { retry } from '@/lib/retry';
import pako from 'pako';
const CACHE_KEYS = {
  HOTNESS_PREFIX: 'game:hotness:',
  CACHE_VIEWS_ARRAY: 'cache:views:array',
  CACHE_DATA_ARRAY: 'cache:data:array',
  CACHE_HASHMAP: 'cache:hashmap:map',
  CACHE_SIZE: 'cache:size',
};

const MAX_CACHE_ENTRIES = 1000;
const PROMOTION_THRESHOLD = 5;
const CACHE_STATE_TTL = 86400;

interface CacheEntry {
  views: number;
  uuid: string;
}

/**
 * Exponential retry wrapper for Redis operations
 * Used for hot cache operations to handle transient failures
 */
export async function redisWithExponentialRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  try {
    return await retry(
      operation,
      maxRetries,
      baseDelayMs,
      true // Enable exponential backoff
    );
  } catch (error) {
    const classified = classifyError(error, `RedisWithExponentialRetry.${operationName}`);
    console.error(`[RedisExponentialRetry] ${operationName} failed after ${maxRetries} attempts:`, classified.message);
    throw error;
  }
}

/**
 * Get hotness count for a uuid with exponential retry
 */
export async function getHotnessWithRetry(uuid: string): Promise<number> {
  return redisWithExponentialRetry(
    () => redis.get<string>(`${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`),
    `getHotness.${uuid}`
  ).then(hotness => hotness ? parseInt(hotness, 10) : 0);
}

/**
 * Increment hotness count with exponential retry
 */
export async function incrementHotnessWithRetry(uuid: string): Promise<number> {
  return redisWithExponentialRetry(
    () => redis.incr(`${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`),
    `incrementHotness.${uuid}`
  );
}

/**
 * Load cache state with exponential retry
 */
export async function loadCacheStateWithRetry(): Promise<{
  views: CacheEntry[];
  data: Map<string, string>;
  hashmap: Map<string, number>;
}> {
  return redisWithExponentialRetry(
    async () => {
      const viewsJson = await redis.get<string>(CACHE_KEYS.CACHE_VIEWS_ARRAY);
      const dataJson = await redis.get<string>(CACHE_KEYS.CACHE_DATA_ARRAY);
      const hashmapJson = await redis.get<string>(CACHE_KEYS.CACHE_HASHMAP);

      const views: CacheEntry[] = viewsJson ? JSON.parse(viewsJson) : [];
      const data: Map<string, string> = dataJson
        ? new Map(JSON.parse(dataJson))
        : new Map<string, string>();
      const hashmap: Map<string, number> = hashmapJson
        ? new Map(JSON.parse(hashmapJson))
        : new Map<string, number>();

      return { views, data, hashmap };
    },
    'loadCacheState'
  );
}

/**
 * Save cache state with exponential retry
 */
export async function saveCacheStateWithRetry(
  views: CacheEntry[],
  data: Map<string, string>,
  hashmap: Map<string, number>
): Promise<void> {
  return redisWithExponentialRetry(
    async () => {
      await Promise.all([
        redis.set(CACHE_KEYS.CACHE_VIEWS_ARRAY, JSON.stringify(views), { ex: CACHE_STATE_TTL }),
        redis.set(CACHE_KEYS.CACHE_DATA_ARRAY, JSON.stringify(Array.from(data.entries())), { ex: CACHE_STATE_TTL }),
        redis.set(CACHE_KEYS.CACHE_HASHMAP, JSON.stringify(Array.from(hashmap.entries())), { ex: CACHE_STATE_TTL }),
        redis.set(CACHE_KEYS.CACHE_SIZE, views.length.toString(), { ex: CACHE_STATE_TTL }),
      ]);
    },
    'saveCacheState'
  );
}

/**
 * Get cached game data with exponential retry
 */
export async function getCachedGameDataWithRetry(uuid: string): Promise<unknown | null> {
  return redisWithExponentialRetry(
    async () => {
      const { data: dataMap, hashmap } = await loadCacheStateWithRetry();

      const idx = hashmap.get(uuid);
      if (idx === undefined) {
        return null;
      }

      const compressed = dataMap.get(uuid);
      if (!compressed) {
        return null;
      }

      return decompressData(compressed);
    },
    `getCachedGameData.${uuid}`
  );
}

/**
 * Clear cache with exponential retry
 */
export async function clearCacheWithRetry(): Promise<number> {
  return redisWithExponentialRetry(
    () => redis.del(
      CACHE_KEYS.CACHE_VIEWS_ARRAY,
      CACHE_KEYS.CACHE_DATA_ARRAY,
      CACHE_KEYS.CACHE_HASHMAP,
      CACHE_KEYS.CACHE_SIZE
    ),
    'clearCache'
  );
}

/**
 * Compress data using pako gzip for Redis storage
 */
export function compressData(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    const compressed = pako.gzip(json);
    return Buffer.from(compressed).toString('base64');
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.compressData");
    console.error('[HotnessCache] Error compressing data:', classified.message);
    return JSON.stringify(data);
  }
}

/**
 * Decompress data from Redis storage
 */
export function decompressData(compressed: string): unknown {
  try {
    const buffer = Buffer.from(compressed, 'base64');
    const decompressed = pako.ungzip(buffer, { to: 'string' });
    return JSON.parse(decompressed);
  } catch {
    // Fall back to direct JSON parsing if not compressed
    try {
      return JSON.parse(compressed);
    } catch (error) {
      const classified = classifyError(error, "HotnessCache.decompressData");
      console.error('[HotnessCache] Error decompressing data:', classified.message);
      return null;
    }
  }
}
