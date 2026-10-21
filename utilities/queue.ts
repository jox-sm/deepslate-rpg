import { redis, parseRedisJson } from "@/lib/queue";
import { getQueueConfig } from "@/types/operations";
import type { OperationProvider, QueueName } from "@/types/operations";
import { v7 as uuidv7 } from "uuid";
import { retry } from "@/lib/retry";
import { tryOrErrorSync, classifyError } from "@/utilities/errorHandler";

export async function enqueue(
  provider: OperationProvider,
  queue: QueueName,
  payload: unknown
): Promise<void> {
  const { redisKey } = getQueueConfig(provider, queue);
  const serialized = JSON.stringify({
    ...(payload as Record<string, unknown>),
    timestamp: Date.now(),
  });
  try {
    await retry(() => redis.rpush(redisKey, serialized), 3, 500);
  } catch (error) {
    const classified = classifyError(error, `queue.enqueue.${provider}.${queue}`);
    console.error('[Queue] enqueue failed:', classified.message);
    throw error;
  }
}

export async function drain<T = unknown>(
  provider: OperationProvider,
  queue: QueueName
): Promise<T[]> {
  const { redisKey } = getQueueConfig(provider, queue);
  const tempKey = `${redisKey}:processing:${uuidv7()}`;

  try {
    await retry(() => redis.rename(redisKey, tempKey), 3, 500);
    const items = await retry(() => redis.lrange(tempKey, 0, -1), 3, 500);
    if (items.length === 0) {
      await retry(() => redis.del(tempKey), 3, 500);
      return [];
    }
    const parsed = items.map((item) => {
      const result = tryOrErrorSync(() => parseRedisJson<T>(item), {
        context: `queue.drain.parse.${provider}.${queue}`,
        suppressToast: true,
        suppressComponent: true,
      });
      if (!result.ok) {
        const classified = classifyError(result.error, `queue.drain.parse.${provider}.${queue}`);
        console.error('[Queue] skipping unparseable item:', classified.message);
        return null;
      }
      return result.data as T;
    }).filter((v): v is T => v !== null);
    await retry(() => redis.del(tempKey), 3, 500);
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.message.includes("no such key")) {
      return [];
    }
    const classified = classifyError(err, `queue.drain.${provider}.${queue}`);
    console.error('[Queue] drain failed:', classified.message);
    throw err;
  }
}

export async function queueSize(
  provider: OperationProvider,
  queue: QueueName
): Promise<number> {
  const { redisKey } = getQueueConfig(provider, queue);
  try {
    return await retry(() => redis.llen(redisKey), 3, 500);
  } catch (error) {
    const classified = classifyError(error, `queue.queueSize.${provider}.${queue}`);
    console.error('[Queue] queueSize failed:', classified.message);
    throw error;
  }
}
