import { redis } from '@/lib/queue';
import { classifyError } from '@/utilities/errorHandler';
import { retry } from '@/lib/retry';
import { CACHE_KEYS } from './constants';

/**
 * Check Redis memory pressure.
 * Upstash REST API does not expose INFO/MEMORY stats, so we always return false.
 * The hotness cache will still work correctly, just without the memory-pressure guard.
 */
export async function checkMemoryPressure(): Promise<boolean> {
  return false;
}

/**
 * Get hotness count for a uuid (how many times accessed but not in cache)
 */
export async function getHotness(uuid: string): Promise<number> {
  const key = `${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`;
  try {
    const hotness = await retry(
      () => redis.get<string>(key),
      3,
      100,
      true
    );
    return hotness ? parseInt(hotness, 10) : 0;
  } catch (error) {
    const classified = classifyError(error, `HotnessCache.getHotness.${uuid}`);
    console.error(`[HotnessCache] Failed to get hotness for ${uuid} after retries:`, classified.message);
    throw error;
  }
}

/**
 * Increment hotness count
 */
export async function incrementHotness(uuid: string): Promise<number> {
  const key = `${CACHE_KEYS.HOTNESS_PREFIX}${uuid}`;
  try {
    return await retry(
      () => redis.incr(key),
      3,
      100,
      true
    );
  } catch (error) {
    const classified = classifyError(error, `HotnessCache.incrementHotness.${uuid}`);
    console.error(`[HotnessCache] Failed to increment hotness for ${uuid} after retries:`, classified.message);
    throw error;
  }
}
