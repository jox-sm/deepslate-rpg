import { redis } from '@/lib/queue';
import { retry } from '@/lib/retry';
import { classifyError } from '@/utilities/errorHandler';
import { QUEUE_KEYS } from './common';
import type { FetchRequest } from './common';

/**
 * Add a game fetch request to the queue
 */
export async function queueGameFetch(
  uuid: string,
  requestId: string
): Promise<void> {
  try {
    const request: FetchRequest = { requestId, uuid };
    await retry(() => redis.lpush(QUEUE_KEYS.FETCH_QUEUE, JSON.stringify(request)), 3, 500);
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.queueGameFetch");
    console.error('[GameFetchPipeline] Error queuing fetch:', classified.message);
    throw error;
  }
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  queueLength: number;
}> {
  try {
    const queueLength = await retry(() => redis.llen(QUEUE_KEYS.FETCH_QUEUE), 3, 500);
    return { queueLength };
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.getQueueStats");
    console.error('[GameFetchPipeline] Error getting queue stats:', classified.message);
    return { queueLength: 0 };
  }
}

/**
 * Clear all pending requests (use with caution)
 */
export async function clearQueue(): Promise<void> {
  try {
    await retry(() => redis.del(QUEUE_KEYS.FETCH_QUEUE), 3, 500);
    console.log('[GameFetchPipeline] Queue cleared');
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.clearQueue");
    console.error('[GameFetchPipeline] Error clearing queue:', classified.message);
  }
}
