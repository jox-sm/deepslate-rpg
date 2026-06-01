'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  cacheHit,
  cacheMiss,
  getCachedGameData,
  getCacheStats,
} from '@/utilities/hotnessCache';
import {
  getGameWithBatchQueue,
} from '@/utilities/clientUtilities/gameFetch';
import { v7 as uuidv7 } from 'uuid';

interface FullGameData {
  id: string;
  name: string;
  description: string;
  image?: string;
  tags?: string[];
  likes_count?: number;
  characters: unknown[];
  maps: unknown[];
  items: unknown[];
  status: string;
}

interface CacheStats {
  entriesCount: number;
  maxEntries: number;
  memoryPressure: boolean;
  queueLength: number;
}

interface UseGameCacheResult {
  data: FullGameData | null;
  loading: boolean;
  error: Error | null;
  cacheStats: CacheStats | null;
  refreshData: () => Promise<void>;
}

/**
 * Hook for accessing GamePage cache with automatic fetching
 * Handles hotness tracking, promotion, and batch queueing
 */
export function useGameCache(gameId: string): UseGameCacheResult {
  const [data, setData] = useState<FullGameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  const requestIdRef = useRef(uuidv7());
  const initializedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try cached data first
      const cached = await getCachedGameData(gameId);
      if (cached) {
        setData(cached as FullGameData);
        // Register hit asynchronously
        cacheHit(gameId, cached).catch((err) =>
          console.error('[useGameCache] Error on cache hit:', err)
        );
        setLoading(false);
        return;
      }

      // Cache miss: queue fetch via batch pipeline
      const result = await cacheMiss(gameId, null);

      if (result.status === 'skip') {
        // Game not promoted to cache, fetch via batch queue
        const fetched = await getGameWithBatchQueue(
          gameId,
          requestIdRef.current
        );
        if (fetched) {
          setData(fetched as FullGameData);
        } else {
          setError(new Error('Failed to fetch game data'));
        }
      } else {
        // Game promoted, fetch via batch queue
        const fetched = await getGameWithBatchQueue(
          gameId,
          requestIdRef.current
        );
        if (fetched) {
          setData(fetched as FullGameData);
        } else {
          setError(new Error('Failed to fetch game data'));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setLoading(false);

      // Update cache stats
      try {
        const stats = await getCacheStats();
        setCacheStats({
          ...stats,
          queueLength: 0, // Not available from client-side
        });
      } catch {
        // Silently fail on stats fetch
      }
    }
  }, [gameId]);

  const refreshData = useCallback(async () => {
    requestIdRef.current = uuidv7();
    await loadData();
  }, [loadData]);

  // Initial load
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadData();
    }
  }, [loadData]);

  return { data, loading, error, cacheStats, refreshData };
}

/**
 * Hook for preloading game data from sessionStorage
 * Used when navigating from ProfileCard with card data
 */
export function useGamePreload(
  gameId: string
): Pick<FullGameData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'> | null {
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

/**
 * Hook for managing sessionStorage preload when navigating
 * Use in ProfileCard onClick handler
 */
export function useGamePreloadStore() {
  return {
    setPreload: (
      gameId: string,
      data: Pick<FullGameData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'>
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
    ): Pick<FullGameData, 'name' | 'description' | 'image' | 'tags' | 'likes_count'> | null => {
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
