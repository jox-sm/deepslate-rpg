import { redis, parseRedisJson } from '@/lib/queue';
import { retry } from '@/lib/retry';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';
import { QUEUE_KEYS } from './common';
import type { FullGameData } from './common';
import { queueGameFetch } from './enqueue';

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
