import { redis, parseRedisJson } from '@/lib/queue';
import { classifyError } from '@/utilities/errorHandler';
import { CACHE_KEYS, CACHE_STATE_TTL, CacheEntry } from './constants';

/**
 * Binary search to find insertion point in views array
 * Returns index where new entry should be inserted (maintains descending order)
 */
export function binarySearchViews(views: CacheEntry[], targetViews: number): number {
  let lo = 0;
  let hi = views.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (views[mid].views <= targetViews) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return lo;
}

/**
 * Load current cache state from Redis
 */
export async function loadCacheState(): Promise<{
  views: CacheEntry[];
  data: Map<string, string>;
  hashmap: Map<string, number>;
}> {
  try {
    const viewsJson = await redis.get<string>(CACHE_KEYS.CACHE_VIEWS_ARRAY);
    const dataJson = await redis.get<string>(CACHE_KEYS.CACHE_DATA_ARRAY);
    const hashmapJson = await redis.get<string>(CACHE_KEYS.CACHE_HASHMAP);

    const views: CacheEntry[] = viewsJson ? parseRedisJson<CacheEntry[]>(viewsJson) : [];
    const data: Map<string, string> = dataJson
      ? new Map(parseRedisJson<[string, string][]>(dataJson))
      : new Map<string, string>();
    const hashmap: Map<string, number> = hashmapJson
      ? new Map(parseRedisJson<[string, number][]>(hashmapJson))
      : new Map<string, number>();

    return { views, data, hashmap };
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.loadCacheState");
    console.error('[HotnessCache] Error loading cache state:', classified.message);
    return {
      views: [],
      data: new Map(),
      hashmap: new Map(),
    };
  }
}

/**
 * Save cache state to Redis
 */
export async function saveCacheState(
  views: CacheEntry[],
  data: Map<string, string>,
  hashmap: Map<string, number>
): Promise<void> {
  try {
    await Promise.all([
      redis.set(CACHE_KEYS.CACHE_VIEWS_ARRAY, JSON.stringify(views), { ex: CACHE_STATE_TTL }),
      redis.set(CACHE_KEYS.CACHE_DATA_ARRAY, JSON.stringify(Array.from(data.entries())), { ex: CACHE_STATE_TTL }),
      redis.set(CACHE_KEYS.CACHE_HASHMAP, JSON.stringify(Array.from(hashmap.entries())), { ex: CACHE_STATE_TTL }),
      redis.set(CACHE_KEYS.CACHE_SIZE, views.length.toString(), { ex: CACHE_STATE_TTL }),
    ]);
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.saveCacheState");
    console.error('[HotnessCache] Error saving cache state:', classified.message);
  }
}
