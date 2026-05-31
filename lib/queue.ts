import Redis from 'ioredis';

const redisClient = () => {
  if (!process.env.redisqueue) throw new Error("REDIS_URL is missing!");
  return new Redis(process.env.redisqueue);
};

const globalForRedis = global as unknown as { redis: Redis };

export const redis = globalForRedis.redis || redisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
