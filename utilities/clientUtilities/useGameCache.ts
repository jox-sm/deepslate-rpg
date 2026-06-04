'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FullGamePageData } from '@/types/gamePage';

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

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/games/${gameId}`);

      if (!res.ok) {
        throw new Error(
          res.status === 404 ? 'Game not found' : 'Failed to fetch game'
        );
      }

      const json = await res.json();

      if (json.success && json.data) {
        setData(json.data as FullGamePageData);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setLoading(false);
    }
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
    try {
      const key = `game:${gameId}:card`;
      const stored = sessionStorage.getItem(key);
      if (stored) {
        setPreloadedData(JSON.parse(stored));
      }
    } catch (err) {
      console.error('[useGamePreload] Error loading preloaded data:', err);
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
      try {
        const key = `game:${gameId}:card`;
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch (err) {
        console.error('[useGamePreloadStore] Error storing preload data:', err);
      }
    },
    getPreload: (
      gameId: string
    ): Pick<FullGamePageData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'> | null => {
      try {
        const key = `game:${gameId}:card`;
        const stored = sessionStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    },
    clearPreload: (gameId: string) => {
      try {
        const key = `game:${gameId}:card`;
        sessionStorage.removeItem(key);
      } catch (err) {
        console.error('[useGamePreloadStore] Error clearing preload data:', err);
      }
    },
  };
}
