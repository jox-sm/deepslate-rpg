import { redis } from '@/lib/queue';
import { classifyError } from '@/utilities/errorHandler';
import { retry } from '@/lib/retry';
import { CACHE_KEYS, MAX_CACHE_ENTRIES } from './constants';
import { checkMemoryPressure } from './hotness';
import { loadCacheState } from './state';
import { decompressData } from './compression';

/**
 * Retrieve cached game data
 */
export async function getCachedGameData(uuid: string): Promise<unknown | null> {
  try {
    const { data: dataMap, hashmap } = await retry(
      () => loadCacheState(),
      3,
      100,
      true
    );

    const idx = hashmap.get(uuid);
    if (idx === undefined) {
      return null;
    }

    const compressed = dataMap.get(uuid);
    if (!compressed) {
      return null;
    }

    return decompressData(compressed);
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.getCachedGameData");
    console.error('[HotnessCache] Error retrieving cached data:', classified.message);
    return null;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  entriesCount: number;
  maxEntries: number;
  memoryPressure: boolean;
}> {
  try {
    const { views } = await retry(
      () => loadCacheState(),
      3,
      100,
      true
    );
    const memoryPressure = await checkMemoryPressure();

    return {
      entriesCount: views.length,
      maxEntries: MAX_CACHE_ENTRIES,
      memoryPressure,
    };
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.getCacheStats");
    console.error('[HotnessCache] Error getting cache stats:', classified.message);
    return {
      entriesCount: 0,
      maxEntries: MAX_CACHE_ENTRIES,
      memoryPressure: false,
    };
  }
}

/**
 * Clear all cache data (use with caution)
 */
export async function clearCache(): Promise<void> {
  try {
    await retry(
      () => redis.del(
        CACHE_KEYS.CACHE_VIEWS_ARRAY,
        CACHE_KEYS.CACHE_DATA_ARRAY,
        CACHE_KEYS.CACHE_HASHMAP,
        CACHE_KEYS.CACHE_SIZE
      ),
      3,
      100,
      true
    );
    console.log('[HotnessCache] Cache cleared');
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.clearCache");
    console.error('[HotnessCache] Error clearing cache:', classified.message);
  }
}
