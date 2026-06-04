// utilities/idempotency.ts
import { v7 as uuidv7 } from 'uuid';
import { redis } from '@/lib/queue';
import { IDEMPOTENCY_TTL_SECONDS } from '@/types/api';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';

// Generate a new idempotency key (UUID v7)
export function generateIdempotencyKey(): string {
  return uuidv7();
}

// Check if a request has already been processed
export async function isRequestProcessed(key: string): Promise<boolean> {
  const exists = await redis.exists(`idempotency:${key}`);
  return exists === 1;
}

// Get cached result for a processed request
export async function getCachedResult<T>(key: string): Promise<T | null> {
  const cached = await redis.get(`idempotency:${key}`);
  if (cached) {
    const result = tryOrErrorSync(() => JSON.parse(cached) as T, { context: "idempotency.getCachedResult" });
    return result.ok ? result.data : null;
  }
  return null;
}

// Store result for a processed request
export async function cacheResult<T>(key: string, result: T): Promise<void> {
  await redis.set(
    `idempotency:${key}`,
    JSON.stringify(result),
    'EX',
    IDEMPOTENCY_TTL_SECONDS
  );
}

// Execute a function with idempotency
// If the request was already processed, return the cached result
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>
): Promise<{ result: T; cached: boolean }> {
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
  await redis.del(`idempotency:${key}`);
}

// Check if key exists and get remaining TTL
export async function getIdempotencyKeyInfo(key: string): Promise<{
  exists: boolean;
  ttl: number;
} | null> {
  const exists = await redis.exists(`idempotency:${key}`);
  if (exists === 0) {
    return null;
  }
  
  const ttl = await redis.ttl(`idempotency:${key}`);
  return { exists: true, ttl };
}