import { redis } from '@/lib/queue';
import pako from 'pako';

/**
 * Hotness Cache: Binary-Search Sorted Cache with Hotness Tracking
 *
 * Two-tier caching:
 * 1. Hotness Map: Tracks access frequency for games NOT in main cache
 * 2. Sorted Cache: Top N most-viewed games, sorted by views descending
 *
 * Uses parallel arrays (views array + data array) for cache-efficient binary search
 */

const CACHE_KEYS = {
  HOTNESS_PREFIX: 'game:hotness:',
  CACHE_VIEWS_ARRAY: 'cache:views:array',
  CACHE_DATA_ARRAY: 'cache:data:array',
  CACHE_HASHMAP: 'cache:hashmap:map',
  CACHE_SIZE: 'cache:size',
};

const MAX_CACHE_ENTRIES = 1000;
const PROMOTION_THRESHOLD = 5; // Promote to cache after 5 hits
const MEMORY_PRESSURE_THRESHOLD = 0.85; // 85% memory usage

interface CacheEntry {
  views: number;
  uuid: string;
}

/**
 * Check Redis memory pressure
 */
export async function checkMemoryPressure(): Promise<boolean> {
  try {
    const info = await redis.info('memory');
    const memoryLines = info.split('\r\n');
    let usedMemory = 0;
    let maxMemory = 0;

    for (const line of memoryLines) {
      if (line.startsWith('used_memory:')) {
        usedMemory = parseInt(line.split(':')[1], 10);
      } else if (line.startsWith('maxmemory:')) {
        maxMemory = parseInt(line.split(':')[1], 10);
      }
    }

    if (maxMemory === 0) return false;
    const pressure = usedMemory / maxMemory;
    return pressure >= MEMORY_PRESSURE_THRESHOLD;
  } catch (error) {
    console.error('[HotnessCache] Error checking memory pressure:', error);
    return false;
  }
}

/**
 * Get hotness count for a uuid (how many times accessed but not in cache)
 */
export async function getHotness(uuid: string): Promise<number> {
  const key = `${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`;
  const hotness = await redis.get(key);
  return hotness ? parseInt(hotness, 10) : 0;
}

/**
 * Increment hotness count
 */
export async function incrementHotness(uuid: string): Promise<number> {
  const key = `${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`;
  return redis.incr(key);
}

/**
 * Binary search to find insertion point in views array
 * Returns index where new entry should be inserted (maintains descending order)
 */
function binarySearchViews(views: CacheEntry[], targetViews: number): number {
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
async function loadCacheState(): Promise<{
  views: CacheEntry[];
  data: Map<string, string>;
  hashmap: Map<string, number>;
}> {
  try {
    const viewsJson = await redis.get(CACHE_KEYS.CACHE_VIEWS_ARRAY);
    const dataJson = await redis.get(CACHE_KEYS.CACHE_DATA_ARRAY);
    const hashmapJson = await redis.get(CACHE_KEYS.CACHE_HASHMAP);

    const views = viewsJson ? JSON.parse(viewsJson) : [];
    const data = dataJson
      ? new Map(JSON.parse(dataJson))
      : new Map<string, string>();
    const hashmap = hashmapJson
      ? new Map(JSON.parse(hashmapJson))
      : new Map<string, number>();

    return { views, data, hashmap };
  } catch (error) {
    console.error('[HotnessCache] Error loading cache state:', error);
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
async function saveCacheState(
  views: CacheEntry[],
  data: Map<string, string>,
  hashmap: Map<string, number>
): Promise<void> {
  try {
    const pipeline = redis.pipeline();

    pipeline.set(
      CACHE_KEYS.CACHE_VIEWS_ARRAY,
      JSON.stringify(views),
      'EX',
      86400
    );
    pipeline.set(
      CACHE_KEYS.CACHE_DATA_ARRAY,
      JSON.stringify(Array.from(data.entries())),
      'EX',
      86400
    );
    pipeline.set(
      CACHE_KEYS.CACHE_HASHMAP,
      JSON.stringify(Array.from(hashmap.entries())),
      'EX',
      86400
    );
    pipeline.set(CACHE_KEYS.CACHE_SIZE, views.length.toString(), 'EX', 86400);

    await pipeline.exec();
  } catch (error) {
    console.error('[HotnessCache] Error saving cache state:', error);
  }
}

/**
 * Cache hit: increment view count and reposition if needed
 */
export async function cacheHit(
  uuid: string,
  data: unknown
): Promise<{ status: 'hit' | 'promoted'; data: unknown }> {
  try {
    const memoryPressure = await checkMemoryPressure();
    if (memoryPressure) {
      await incrementHotness(uuid);
      return { status: 'hit', data };
    }

    const { views, data: dataMap, hashmap } = await loadCacheState();
    const idx = hashmap.get(uuid);

    if (idx === undefined) {
      return { status: 'hit', data };
    }

    // Increment view count
    views[idx].views += 1;
    const newViews = views[idx].views;

    // Check if repositioning is needed
    const lowerBound = binarySearchViews(views, newViews + 1);
    const upperBound = binarySearchViews(views, newViews);

    if (idx < lowerBound || idx >= upperBound) {
      const entry = views[idx];
      const entryData = dataMap.get(uuid)!;

      // Remove from current position
      views.splice(idx, 1);
      dataMap.delete(uuid);

      // Insert at correct position
      const newPos = idx < upperBound ? upperBound - 1 : upperBound;
      views.splice(newPos, 0, entry);
      dataMap.set(uuid, entryData);

      // Reindex hashmap from minimum affected index
      const minIdx = Math.min(idx, newPos);
      for (let i = minIdx; i < views.length; i++) {
        hashmap.set(views[i].uuid, i);
      }

      await saveCacheState(views, dataMap, hashmap);
    }

    return { status: 'hit', data };
  } catch (error) {
    console.error('[HotnessCache] Error on cache hit:', error);
    return { status: 'hit', data };
  }
}

/**
 * Cache miss: check hotness and promote if threshold reached
 */
export async function cacheMiss(
  uuid: string,
  data: unknown
): Promise<{ status: 'skip' | 'promoted'; data?: unknown }> {
  try {
    const hotness = await incrementHotness(uuid);

    if (hotness < PROMOTION_THRESHOLD) {
      return { status: 'skip' };
    }

    const memoryPressure = await checkMemoryPressure();

    // Don't promote if memory pressure is high
    if (memoryPressure) {
      return { status: 'skip' };
    }

    const { views, data: dataMap, hashmap } = await loadCacheState();

    // Check barrier: can only enter if views > lowest entry (when full)
    if (views.length >= MAX_CACHE_ENTRIES) {
      const barrier = views[views.length - 1]?.views ?? 0;
      if (hotness <= barrier) {
        return { status: 'skip' };
      }
    }

    // Compress and add to cache
    const compressedData = compressData(data);

    if (views.length < MAX_CACHE_ENTRIES) {
      const pos = binarySearchViews(views, hotness);
      views.splice(pos, 0, { views: hotness, uuid });
      dataMap.set(uuid, compressedData);

      // Reindex from position
      for (let i = pos; i < views.length; i++) {
        hashmap.set(views[i].uuid, i);
      }
    } else {
      // Evict lowest entry
      const evicted = views.pop();
      if (evicted) {
        dataMap.delete(evicted.uuid);
        hashmap.delete(evicted.uuid);
      }

      const pos = binarySearchViews(views, hotness);
      views.splice(pos, 0, { views: hotness, uuid });
      dataMap.set(uuid, compressedData);

      // Reindex from position
      for (let i = pos; i < views.length; i++) {
        hashmap.set(views[i].uuid, i);
      }
    }

    await saveCacheState(views, dataMap, hashmap);
    await redis.del(`${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`);

    return { status: 'promoted', data };
  } catch (error) {
    console.error('[HotnessCache] Error on cache miss:', error);
    return { status: 'skip' };
  }
}

/**
 * Retrieve cached game data
 */
export async function getCachedGameData(uuid: string): Promise<unknown | null> {
  try {
    const { data: dataMap, hashmap } = await loadCacheState();

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
    console.error('[HotnessCache] Error retrieving cached data:', error);
    return null;
  }
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
    console.error('[HotnessCache] Error compressing data:', error);
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
      console.error('[HotnessCache] Error decompressing data:', error);
      return null;
    }
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
    const { views } = await loadCacheState();
    const memoryPressure = await checkMemoryPressure();

    return {
      entriesCount: views.length,
      maxEntries: MAX_CACHE_ENTRIES,
      memoryPressure,
    };
  } catch (error) {
    console.error('[HotnessCache] Error getting cache stats:', error);
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
    await redis.del(
      CACHE_KEYS.CACHE_VIEWS_ARRAY,
      CACHE_KEYS.CACHE_DATA_ARRAY,
      CACHE_KEYS.CACHE_HASHMAP,
      CACHE_KEYS.CACHE_SIZE
    );
    console.log('[HotnessCache] Cache cleared');
  } catch (error) {
    console.error('[HotnessCache] Error clearing cache:', error);
  }
}
