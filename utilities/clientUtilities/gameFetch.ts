'use client';

import { v7 as uuidv7 } from 'uuid';
import { tryOrError } from '@/utilities/errorHandler';

export async function requestGameFetch(
  uuid: string,
  requestId: string = uuidv7()
): Promise<{ requestId: string }> {
  const result = await tryOrError(async () => {
    const response = await fetch('/api/games/batch-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, requestId }),
    });

    if (!response.ok) {
      throw new Error('Failed to queue fetch request');
    }

    return { requestId };
  }, { context: "requestGameFetch" });

  if (!result.ok) {
    throw new Error(result.error?.message || 'Failed to queue fetch request');
  }

  return result.data!;
}

export async function pollGameResult(
  requestId: string,
  timeoutMs: number = 5000
): Promise<any | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await tryOrError(async () => {
      const response = await fetch(`/api/games/batch-result/${requestId}`);

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return null;
      }

      throw new Error('Failed to fetch result');
    }, { context: "pollGameResult" });

    if (result.ok && result.data !== null) {
      return result.data;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function getGameWithBatchQueue(
  uuid: string,
  requestId?: string
): Promise<any | null> {
  const id = requestId || uuidv7();

  const result = await tryOrError(async () => {
    await requestGameFetch(uuid, id);
    return await pollGameResult(id);
  }, { context: "getGameWithBatchQueue" });

  return result.ok ? result.data : null;
}
