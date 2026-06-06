import { redis } from "@/lib/queue";
import { getQueueConfig } from "@/types/operations";
import type { OperationProvider, QueueName } from "@/types/operations";

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
  await redis.rpush(redisKey, serialized);
}

export async function drain<T = unknown>(
  provider: OperationProvider,
  queue: QueueName
): Promise<T[]> {
  const { redisKey } = getQueueConfig(provider, queue);
  const tempKey = `${redisKey}:processing:${Date.now()}`;

  try {
    await redis.rename(redisKey, tempKey);
    const items = await redis.lrange(tempKey, 0, -1);
    if (items.length === 0) {
      await redis.del(tempKey);
      return [];
    }
    const parsed = items.map((item) => JSON.parse(item) as T);
    await redis.del(tempKey);
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.message.includes("no such key")) {
      return [];
    }
    throw err;
  }
}

export async function queueSize(
  provider: OperationProvider,
  queue: QueueName
): Promise<number> {
  const { redisKey } = getQueueConfig(provider, queue);
  return await redis.llen(redisKey);
}
