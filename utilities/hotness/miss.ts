import { redis } from '@/lib/queue';
import { classifyError } from '@/utilities/errorHandler';
import { retry } from '@/lib/retry';
import { CACHE_KEYS, MAX_CACHE_ENTRIES, PROMOTION_THRESHOLD } from './constants';
import { checkMemoryPressure, incrementHotness } from './hotness';
import { binarySearchViews, loadCacheState, saveCacheState } from './state';
import { compressData } from './compression';

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

    const { views, data: dataMap, hashmap } = await retry(
      () => loadCacheState(),
      3,
      100,
      true
    );

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

    await retry(
      () => saveCacheState(views, dataMap, hashmap),
      3,
      100,
      true
    );
    await retry(
      () => redis.del(`${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`),
      3,
      100,
      true
    );

    return { status: 'promoted', data };
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.cacheMiss");
    console.error('[HotnessCache] Error on cache miss:', classified.message);
    return { status: 'skip' };
  }
}
