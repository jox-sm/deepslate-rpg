import { classifyError } from '@/utilities/errorHandler';
import { retry } from '@/lib/retry';
import { checkMemoryPressure, incrementHotness } from './hotness';
import { binarySearchViews, loadCacheState, saveCacheState } from './state';

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

    const { views, data: dataMap, hashmap } = await retry(
      () => loadCacheState(),
      3,
      100,
      true
    );
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

      await retry(
        () => saveCacheState(views, dataMap, hashmap),
        3,
        100,
        true
      );
    }

    return { status: 'hit', data };
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.cacheHit");
    console.error('[HotnessCache] Error on cache hit:', classified.message);
    return { status: 'hit', data };
  }
}
