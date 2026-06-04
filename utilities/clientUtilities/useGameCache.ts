'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FullGamePageData } from '@/types/gamePage';
import { tryOrError, tryOrErrorSync, isNotFound, isServerError } from '@/utilities/errorHandler';

interface UseGameCacheResult {
  data: FullGamePageData | null;
  loading: boolean;
  error: Error | null;
  cacheStats: Record<string, never> | null;
  refreshData: () => Promise<void>;
}

export function useGameCache(gameId: string): UseGameCacheResult {
  const [data, setData] = useState<FullGamePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const initializedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await tryOrError(async () => {
      const res = await fetch(`/api/games/${gameId}`);

      if (!res.ok) {
        throw new Error(
          res.status === 404 ? 'Game not found' : 'Failed to fetch game'
        );
      }

      const json = await res.json();

      if (json.success && json.data) {
        return json.data as FullGamePageData;
      }

      throw new Error('Invalid response from server');
    }, { context: "useGameCache" });

    if (result.ok && result.data) {
      setData(result.data);
    } else {
      if (result.error) {
        setError(new Error(result.error.message));
      } else {
        setError(new Error('Unknown error'));
      }
      setData(null);
    }

    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadData();
    }
  }, [loadData]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return { data, loading, error, cacheStats: null, refreshData };
}

export function useGamePreload(
  gameId: string
): Pick<FullGamePageData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'> | null {
  const [preloadedData, setPreloadedData] = useState(null);

  useEffect(() => {
    const key = `game:${gameId}:card`;
    const result = tryOrErrorSync(() => {
      const stored = sessionStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    }, { context: "useGamePreload" });

    if (result.ok && result.data) {
      setPreloadedData(result.data);
    }
  }, [gameId]);

  return preloadedData;
}

export function useGamePreloadStore() {
  return {
    setPreload: (
      gameId: string,
      data: Pick<FullGamePageData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'>
    ) => {
      tryOrErrorSync(() => {
        const key = `game:${gameId}:card`;
        sessionStorage.setItem(key, JSON.stringify(data));
      }, { context: "setPreload" });
    },
    getPreload: (
      gameId: string
    ): Pick<FullGamePageData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'> | null => {
      const result = tryOrErrorSync(() => {
        const key = `game:${gameId}:card`;
        const stored = sessionStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      }, { context: "getPreload" });
      return result.ok ? (result.data as Pick<FullGamePageData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'> | null) : null;
    },
    clearPreload: (gameId: string) => {
      tryOrErrorSync(() => {
        const key = `game:${gameId}:card`;
        sessionStorage.removeItem(key);
      }, { context: "clearPreload" });
    },
  };
}
