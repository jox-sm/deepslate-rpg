import { redis } from '@/lib/queue';
import { getGameById } from '@/lib/db';
import connectDB from '@/models/games/mongodb/client';
import Game from '@/models/games/mongodb/schema';
import { retry } from '@/lib/retry';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';

/**
 * Batch Game Fetch Pipeline
 *
 * Collects fetch requests into a queue and processes them in batches
 * to minimize database round trips. Uses Redis queue for async processing.
 */

const QUEUE_KEYS = {
  FETCH_QUEUE: 'game:fetch:queue',
  REQUEST_RESULTS: 'game:fetch:results:',
};

const BATCH_SIZE = 20; // Process 20 games per batch
const BATCH_TIMEOUT_MS = 200; // Wait up to 200ms for a full batch

interface FetchRequest {
  requestId: string;
  uuid: string;
}

interface FullGameData {
  id: string;
  name: string;
  description: string;
  image?: string;
  tags?: string[];
  likes_count?: number;
  created_at?: string;
  updated_at?: string;
  characters: unknown[];
  maps: unknown[];
  items: unknown[];
  status: string;
}

/**
 * Add a game fetch request to the queue
 */
export async function queueGameFetch(
  uuid: string,
  requestId: string
): Promise<void> {
  try {
    const request: FetchRequest = { requestId, uuid };
    await redis.lpush(QUEUE_KEYS.FETCH_QUEUE, JSON.stringify(request));
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.queueGameFetch");
    console.error('[GameFetchPipeline] Error queuing fetch:', classified.message);
    throw error;
  }
}

/**
 * Process batch of fetch requests (runs in background)
 */
export async function processBatch(): Promise<void> {
  try {
    // Wait a bit for more requests to queue up (up to BATCH_TIMEOUT_MS)
    await new Promise((resolve) => setTimeout(resolve, BATCH_TIMEOUT_MS));

    // Get up to BATCH_SIZE requests from queue
    const requestsJson = (await redis.lrange(
      QUEUE_KEYS.FETCH_QUEUE,
      0,
      BATCH_SIZE - 1
    )) as string[];

    if (requestsJson.length === 0) {
      return;
    }

    const requests: FetchRequest[] = requestsJson
      .map((json) => {
        const result = tryOrErrorSync(() => JSON.parse(json), { context: "parseFetchRequest" });
        return result.ok ? result.data as FetchRequest : null;
      })
      .filter((req): req is FetchRequest => req !== null);

    if (requests.length === 0) {
      return;
    }

    console.log(
      `[GameFetchPipeline] Processing batch of ${requests.length} requests`
    );

    // Extract unique uuids
    const uuids = [...new Set(requests.map((r) => r.uuid))];

    // Fetch from PostgreSQL
    const pgGames = await Promise.all(
      uuids.map((uuid) => retry(() => getGameById(uuid), 2, 300))
    );

    // Fetch from MongoDB for nested data
    await connectDB();
    const mongoGames = await Promise.all(
      uuids.map((uuid) =>
        retry(() => Game.findOne({ id: uuid }).lean(), 2, 300).catch(() => null)
      )
    );

    // Build result map
    const resultMap = new Map<string, FullGameData | null>();

    for (let i = 0; i < uuids.length; i++) {
      const uuid = uuids[i];
      const pgGame = pgGames[i];
      const mongoGame = mongoGames[i];

      if (!pgGame) {
        resultMap.set(uuid, null);
        continue;
      }

      const fullGame: FullGameData = {
        ...pgGame,
        characters: mongoGame?.characters || [],
        maps: mongoGame?.maps || [],
        items: mongoGame?.items || [],
        status: mongoGame?.status || 'draft',
      };

      resultMap.set(uuid, fullGame);
    }

    // Store results and clean queue
    const operations: Promise<unknown>[] = [];

    for (const request of requests) {
      const result = resultMap.get(request.uuid);
      const resultKey = `${QUEUE_KEYS.REQUEST_RESULTS}${request.requestId}`;

      operations.push(
        redis.set(
          resultKey,
          JSON.stringify(result || { success: false, error: 'Not found' }),
          { ex: 3600 }
        )
      );
    }

    // Remove processed requests from queue
    for (let i = 0; i < requests.length; i++) {
      operations.push(redis.rpop(QUEUE_KEYS.FETCH_QUEUE));
    }

    await Promise.all(operations);

    console.log(
      `[GameFetchPipeline] Batch processed, results stored for ${requests.length} requests`
    );
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.processBatch");
    console.error('[GameFetchPipeline] Error processing batch:', classified.message);
  }
}

/**
 * Wait for and retrieve a game fetch result
 */
export async function waitForFetchResult(
  requestId: string,
  timeoutMs: number = 5000
): Promise<FullGameData | null> {
  const resultKey = `${QUEUE_KEYS.REQUEST_RESULTS}${requestId}`;
  const startTime = Date.now();

  // Poll with backoff
  while (Date.now() - startTime < timeoutMs) {
    const result = await redis.get<string>(resultKey);

    if (result) {
      const parseResult = tryOrErrorSync(() => JSON.parse(result), { context: "parseFetchResult" });
      if (parseResult.ok) {
        await redis.del(resultKey);
        const data = parseResult.data;
        return data.success === false ? null : data;
      }
      return null;
    }

    // Wait before retrying (exponential backoff up to 100ms)
    const waitTime = Math.min(100, 10 + (Date.now() - startTime) / 100);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  return null;
}

/**
 * Get a game with automatic batch queueing
 * (Use when you want the pipeline to handle queueing transparently)
 */
export async function getGameWithBatchQueue(
  uuid: string,
  requestId: string
): Promise<FullGameData | null> {
  try {
    // Queue the request
    await queueGameFetch(uuid, requestId);

    // Wait for result
    const result = await waitForFetchResult(requestId, 5000);

    return result;
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.getGameWithBatchQueue");
    console.error('[GameFetchPipeline] Error getting game with batch queue:', classified.message);
    return null;
  }
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  queueLength: number;
}> {
  try {
    const queueLength = await redis.llen(QUEUE_KEYS.FETCH_QUEUE);
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
    await redis.del(QUEUE_KEYS.FETCH_QUEUE);
    console.log('[GameFetchPipeline] Queue cleared');
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.clearQueue");
    console.error('[GameFetchPipeline] Error clearing queue:', classified.message);
  }
}
