import { redis, parseRedisJson } from '@/lib/queue';
import { getGameById } from '@/lib/db';
import connectDB from '@/models/games/mongodb/client';
import Game from '@/models/games/mongodb/schema';
import { retry } from '@/lib/retry';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';
import { getCachedGameData, cacheHit, cacheMiss } from '@/utilities/hotnessCache';

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
    await retry(() => redis.lpush(QUEUE_KEYS.FETCH_QUEUE, JSON.stringify(request)), 3, 500);
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

    // Atomically claim up to BATCH_SIZE requests.
    // The old code read the head with LRANGE but removed from the tail with
    // RPOP, so whenever more than BATCH_SIZE requests were queued it
    // dropped the ones it had not processed and reprocessed the ones it
    // had. LPOP with a count is a single atomic operation and matches the
    // LPUSH used to enqueue (FIFO).
    const requestsJson = ((await retry(
      () => redis.lpop(QUEUE_KEYS.FETCH_QUEUE, BATCH_SIZE),
      3,
      500
    )) ?? []) as string[];

    if (requestsJson.length === 0) {
      return;
    }

    const requests: FetchRequest[] = requestsJson
      .map((json) => {
        const result = tryOrErrorSync(() => parseRedisJson<FetchRequest>(json), { context: "parseFetchRequest" });
        return result.ok ? result.data : null;
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

    // 1) Hotness cache first. A cache hit costs one Redis read and spares
    //    both the Neon and the MongoDB round trip. This is the same tiered
    //    lookup the single-game route does, applied across the whole batch.
    const cached = await Promise.all(
      uuids.map((uuid) =>
        retry(() => getCachedGameData(uuid), 2, 300).catch(() => null)
      )
    );

    // 2) Only the misses need the databases.
    const misses = uuids.filter((_, i) => !cached[i]);

    // Fetch from PostgreSQL
    const pgGames = await Promise.all(
      misses.map((uuid) => retry(() => getGameById(uuid), 2, 300))
    );

    // Fetch from MongoDB for nested data. MongoDB is an optional enrichment
    // here: if it is unreachable, still serve the Neon row (without nested
    // data) instead of failing the whole batch.
    const mongoGames = await (async () => {
      if (misses.length === 0) return [];
      try {
        await connectDB();
        return await Promise.all(
          misses.map((uuid) =>
            retry(() => Game.findOne({ id: uuid }).lean(), 2, 300).catch((error) => {
              const classified = classifyError(error, `GameFetchPipeline.mongo.${uuid}`);
              console.error('[GameFetchPipeline] Mongo fetch failed:', classified.message, '| raw:', String(classified.originalError ?? error));
              return null;
            })
          )
        );
      } catch (error) {
        const classified = classifyError(error, "GameFetchPipeline.connectDB");
        console.error('[GameFetchPipeline] MongoDB unavailable, serving without nested data:', classified.message, '| raw:', String(classified.originalError ?? error));
        return misses.map(() => null);
      }
    })();

    // Build result map
    const resultMap = new Map<string, FullGameData | null>();

    for (let i = 0; i < uuids.length; i++) {
      const uuid = uuids[i];
      const hit = cached[i];

      if (hit) {
        resultMap.set(uuid, hit as FullGameData);
        // Record the view so the entry keeps its hotness ranking.
        cacheHit(uuid, hit).catch((error) => {
          const classified = classifyError(error, `GameFetchPipeline.cacheHit.${uuid}`);
          console.error('[GameFetchPipeline] cacheHit failed:', classified.message);
        });
        continue;
      }

      const missIdx = misses.indexOf(uuid);
      const pgGame = missIdx >= 0 ? pgGames[missIdx] : null;
      const mongoGame = missIdx >= 0 ? mongoGames[missIdx] : null;

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

      // Promote into the hotness cache so the next request is a cache hit.
      cacheMiss(uuid, fullGame).catch((error) => {
        const classified = classifyError(error, `GameFetchPipeline.cacheMiss.${uuid}`);
        console.error('[GameFetchPipeline] cacheMiss failed:', classified.message);
      });
    }

    // Store results and clean queue
    const operations: Promise<unknown>[] = [];

    for (const request of requests) {
      const result = resultMap.get(request.uuid);
      const resultKey = `${QUEUE_KEYS.REQUEST_RESULTS}${request.requestId}`;

      operations.push(
        retry(
          () =>
            redis.set(
              resultKey,
              JSON.stringify(result || { success: false, error: 'Not found' }),
              { ex: 3600 }
            ),
          3,
          500
        )
      );
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
 * Read a batch fetch result without blocking.
 * Returns null when the batch has not produced the result yet, which the
 * HTTP route surfaces as 404 so the client can keep polling.
 */
export async function getFetchResult(requestId: string): Promise<FullGameData | null> {
  const resultKey = `${QUEUE_KEYS.REQUEST_RESULTS}${requestId}`;
  try {
    const raw = await retry(() => redis.get(resultKey), 3, 300);
    if (!raw) return null;

    const parsed = tryOrErrorSync(
      () => parseRedisJson<FullGameData & { success?: boolean; error?: string }>(raw),
      { context: "GameFetchPipeline.getFetchResult", suppressToast: true, suppressComponent: true }
    );
    if (!parsed.ok) {
      const classified = classifyError(parsed.error, "GameFetchPipeline.getFetchResult.parse");
      console.error('[GameFetchPipeline] result parse failed:', classified.message);
      return null;
    }

    // One-shot: the key is consumed so a later poll cannot re-read it.
    await retry(() => redis.del(resultKey), 3, 300).catch((error) => {
      const classified = classifyError(error, "GameFetchPipeline.getFetchResult.del");
      console.error('[GameFetchPipeline] result cleanup failed:', classified.message);
    });

    const data = parsed.data;
    if (!data) return null;
    return data.success === false ? null : data;
  } catch (error) {
    const classified = classifyError(error, "GameFetchPipeline.getFetchResult");
    console.error('[GameFetchPipeline] result read failed:', classified.message);
    return null;
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
    let result: string | null = null;
    try {
      result = await retry(() => redis.get<string>(resultKey), 3, 300);
    } catch (error) {
      const classified = classifyError(error, "GameFetchPipeline.waitForFetchResult.get");
      console.error('[GameFetchPipeline] result poll failed:', classified.message);
      return null;
    }

    if (result) {
      const parseResult = tryOrErrorSync(() => parseRedisJson<FullGameData & { success?: boolean; error?: string }>(result), { context: "parseFetchResult" });
      if (parseResult.ok) {
        try {
          await retry(() => redis.del(resultKey), 3, 300);
        } catch (error) {
          const classified = classifyError(error, "GameFetchPipeline.waitForFetchResult.del");
          console.error('[GameFetchPipeline] result cleanup failed:', classified.message);
        }
        const data = parseResult.data;
        if (!data) return null;
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
