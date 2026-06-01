'use client';

import { v7 as uuidv7 } from 'uuid';

/**
 * Client-side wrapper for game fetch requests
 * Sends requests to the batch pipeline API
 */

export async function requestGameFetch(
  uuid: string,
  requestId: string = uuidv7()
): Promise<{ requestId: string }> {
  try {
    const response = await fetch('/api/games/batch-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, requestId }),
    });

    if (!response.ok) {
      throw new Error('Failed to queue fetch request');
    }

    return { requestId };
  } catch (error) {
    console.error('[ClientGameFetch] Error:', error);
    throw error;
  }
}

/**
 * Poll for game fetch result
 */
export async function pollGameResult(
  requestId: string,
  timeoutMs: number = 5000
): Promise<any | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`/api/games/batch-result/${requestId}`);

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 404) {
        // Still processing, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      throw new Error('Failed to fetch result');
    } catch (error) {
      console.error('[ClientGameFetch] Poll error:', error);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return null;
}

/**
 * Get game with batch queueing (client-side)
 */
export async function getGameWithBatchQueue(
  uuid: string,
  requestId?: string
): Promise<any | null> {
  const id = requestId || uuidv7();

  try {
    await requestGameFetch(uuid, id);
    return await pollGameResult(id);
  } catch (error) {
    console.error('[ClientGameFetch] Error:', error);
    return null;
  }
}
