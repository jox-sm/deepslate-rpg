import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Legacy ioredis (Redis.io / Redis Cloud) — kept for future use ───
// import IORedis from 'ioredis';
//
// const legacyRedisClient = () => {
//   if (!process.env.redisqueue) throw new Error("REDIS_URL is missing!");
//   return new IORedis(process.env.redisqueue);
// };
//
// const globalForRedis = global as unknown as { legacyRedis: IORedis };
// const legacyRedis = globalForRedis.legacyRedis || legacyRedisClient();
// if (process.env.NODE_ENV !== 'production') globalForRedis.legacyRedis = legacyRedis;
//
// export { redis, legacyRedis };

export { redis };
