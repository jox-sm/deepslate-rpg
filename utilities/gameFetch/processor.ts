import { redis, parseRedisJson } from '@/lib/queue';
import { getGameById } from '@/lib/db';
import connectDB from '@/models/games/mongodb/client';
import Game from '@/models/games/mongodb/schema';
import { retry } from '@/lib/retry';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';
import { getCachedGameData, cacheHit, cacheMiss } from '@/utilities/hotnessCache';
import { BATCH_SIZE, BATCH_TIMEOUT_MS, QUEUE_KEYS } from './common';
import type { FetchRequest, FullGameData } from './common';

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
