// utilities/idempotency.ts
import { v7 as uuidv7 } from 'uuid';
import { redis, parseRedisJson } from '@/lib/queue';
import { IDEMPOTENCY_TTL_SECONDS } from '@/types/api';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';
import { retry } from '@/lib/retry';

// Generate a new idempotency key (UUID v7)
export function generateIdempotencyKey(): string {
  return uuidv7();
}

// Check if a request has already been processed
export async function isRequestProcessed(key: string): Promise<boolean> {
  try {
    const exists = await retry(() => redis.exists(`idempotency:${key}`), 3, 500);
    return exists === 1;
  } catch (error) {
    const classified = classifyError(error, "idempotency.isRequestProcessed");
    console.error('[Idempotency] isRequestProcessed failed:', classified.message);
    throw error;
  }
}

// Get cached result for a processed request
export async function getCachedResult<T>(key: string): Promise<T | null> {
  try {
    const cached = await retry(() => redis.get<string>(`idempotency:${key}`), 3, 500);
    if (cached) {
      const result = tryOrErrorSync(() => parseRedisJson<T>(cached), { context: "idempotency.getCachedResult" });
      return result.ok ? result.data : null;
    }
    return null;
  } catch (error) {
    const classified = classifyError(error, "idempotency.getCachedResult");
    console.error('[Idempotency] getCachedResult failed:', classified.message);
    throw error;
  }
}

// Store result for a processed request
export async function cacheResult<T>(key: string, result: T): Promise<void> {
  try {
    await retry(
      () =>
        redis.set(`idempotency:${key}`, JSON.stringify(result), {
          ex: IDEMPOTENCY_TTL_SECONDS,
        }),
      3,
      500
    );
  } catch (error) {
    const classified = classifyError(error, "idempotency.cacheResult");
    console.error('[Idempotency] cacheResult failed:', classified.message);
    throw error;
  }
}

// Execute a function with idempotency
// If the request was already processed, return the cached result
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>
): Promise<{ result: T; cached: boolean }> {
  try {
    // Check if already processed
    const cached = await getCachedResult<T>(key);
    if (cached !== null) {
      return { result: cached, cached: true };
    }

    // Execute the function
    const result = await fn();

    // Cache the result
    await cacheResult(key, result);

    return { result, cached: false };
  } catch (error) {
    const classified = classifyError(error, "idempotency.withIdempotency");
    console.error('[Idempotency] withIdempotency failed:', classified.message);
    throw error;
  }
}

// Execute a function with idempotency and error handling
export async function withIdempotencySafe<T>(
  key: string,
  fn: () => Promise<T>
): Promise<{ result: T | null; cached: boolean; error?: string }> {
  try {
    const cached = await getCachedResult<T>(key);
    if (cached !== null) {
      return { result: cached, cached: true };
    }
    
    const result = await fn();
    
    await cacheResult(key, result);
    
    return { result, cached: false };
  } catch (error) {
    const classified = classifyError(error, "idempotency.withIdempotencySafe");
    return { result: null, cached: false, error: classified.message };
  }
}

// Clear idempotency key (for testing or manual cleanup)
export async function clearIdempotencyKey(key: string): Promise<void> {
  try {
    await retry(() => redis.del(`idempotency:${key}`), 3, 500);
  } catch (error) {
    const classified = classifyError(error, "idempotency.clearIdempotencyKey");
    console.error('[Idempotency] clear failed:', classified.message);
    throw error;
  }
}

// Check if key exists and get remaining TTL
export async function getIdempotencyKeyInfo(key: string): Promise<{
  exists: boolean;
  ttl: number;
} | null> {
  try {
    const exists = await retry(() => redis.exists(`idempotency:${key}`), 3, 500);
    if (exists === 0) {
      return null;
    }

    const ttl = await retry(() => redis.ttl(`idempotency:${key}`), 3, 500);
    return { exists: true, ttl };
  } catch (error) {
    const classified = classifyError(error, "idempotency.getIdempotencyKeyInfo");
    console.error('[Idempotency] getKeyInfo failed:', classified.message);
    throw error;
  }
}