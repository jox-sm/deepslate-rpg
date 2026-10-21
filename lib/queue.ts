import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  // IMPORTANT: Upstash retries every command 5x internally with exponential
  // backoff (~12s per logical call). Our code already retries at the app
  // layer (lib/retry + redisWithExponentialRetry), so client retries multiply
  // into 15-45 HTTP attempts per op and turn a Redis outage into 40s+
  // request times. Single retry layer: ours.
  retry: false,
  // IMPORTANT: the SDK auto-deserializes JSON on every read by default.
  // Our code stores payloads as JSON *text* and parses them itself
  // (redis.get<string>(...) + JSON.parse(...)), so auto-deserialization
  // handed back already-parsed values and JSON.parse() then threw
  // ("[object Object]" is not valid JSON) - which made the queue drain
  // discard every item as "unparseable" and the hotness/batch caches
  // read as empty. Read raw and parse explicitly.
  automaticDeserialization: false,
});

/**
 * Parse a JSON payload that may already be deserialized.
 * With automaticDeserialization disabled the SDK returns raw strings, but
 * this keeps the read sites working against either shape.
 */
export function parseRedisJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}


export { redis };
