export type OperationProvider = "neon" | "mongodb";

export type QueueName = "games" | "likes";

export interface QueueConfig {
  redisKey: string;
}

export const queueConfig: Record<OperationProvider, Record<QueueName, QueueConfig>> = {
  neon: {
    games: { redisKey: "InsertGames" },
    likes: { redisKey: "InsertLikes" },
  },
  mongodb: {
    games: { redisKey: "InsertGamesmongodb" },
    likes: { redisKey: "InsertLikes" },
  },
};

export function getQueueConfig(provider: OperationProvider, queue: QueueName): QueueConfig {
  const config = queueConfig[provider]?.[queue];
  if (!config) {
    throw new Error(`No queue config for provider="${provider}" queue="${queue}"`);
  }
  return config;
}
