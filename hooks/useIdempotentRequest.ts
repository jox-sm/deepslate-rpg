// hooks/useIdempotentRequest.ts
"use client";

import { v7 as uuidv7 } from 'uuid';
import { useRef, useCallback } from 'react';
import { REQUEST_TIMEOUT_MS } from '@/types/api';
import { classifyError } from '@/utilities/errorHandler';

interface AbortableRequest {
  controller: AbortController;
  timeout: ReturnType<typeof setTimeout>;
}

export function useIdempotentRequest() {
  const requestRef = useRef<Map<string, AbortableRequest>>(new Map());

  const sendRequest = useCallback(async <T>(
    url: string,
    data: unknown,
    options?: {
      idempotencyKey?: string;
      timeout?: number;
      retryOnAbort?: boolean;
    }
  ): Promise<T> => {
    const key = options?.idempotencyKey || uuidv7();
    const timeoutMs = options?.timeout || REQUEST_TIMEOUT_MS;

    const attempt = async (retryOnAbort: boolean): Promise<T> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      requestRef.current.set(key, { controller, timeout: timeoutId });

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: key, ...data as object }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }

        return response.json();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          const classified = classifyError(error, `useIdempotentRequest.abort-${key}`);
          console.log(`Request aborted for key: ${key}`, classified.message);

          if (retryOnAbort) {
            console.log(`Retrying with same idempotency key: ${key}`);
            return attempt(false);
          }

          throw new Error('Request aborted');
        }
        const classified = classifyError(error, `useIdempotentRequest.send-${key}`);
        console.error(`[useIdempotentRequest] request failed for key: ${key}`, classified.message);
        throw new Error(classified.message);
      } finally {
        clearTimeout(timeoutId);
        requestRef.current.delete(key);
      }
    };

    return attempt(options?.retryOnAbort ?? true);
  }, []);

  const abortRequest = useCallback((key: string): boolean => {
    const request = requestRef.current.get(key);
    if (request) {
      request.controller.abort();
      clearTimeout(request.timeout);
      requestRef.current.delete(key);
      return true;
    }
    return false;
  }, []);

  const abortAll = useCallback(() => {
    requestRef.current.forEach((request) => {
      request.controller.abort();
      clearTimeout(request.timeout);
    });
    requestRef.current.clear();
  }, []);

  const getActiveRequests = useCallback(() => {
    return Array.from(requestRef.current.keys());
  }, []);

  return {
    sendRequest,
    abortRequest,
    abortAll,
    getActiveRequests,
  };
}
