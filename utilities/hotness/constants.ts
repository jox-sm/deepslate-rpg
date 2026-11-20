/**
 * Hotness Cache: Binary-Search Sorted Cache with Hotness Tracking
 *
 * Two-tier caching:
 * 1. Hotness Map: Tracks access frequency for games NOT in main cache
 * 2. Sorted Cache: Top N most-viewed games, sorted by views descending
 *
 * Uses parallel arrays (views array + data array) for cache-efficient binary search
 *
 * Shared configuration and types. These are immutable values shared by reference
 * across every module of the hotness cache.
 */

export const CACHE_KEYS = {
  HOTNESS_PREFIX: 'game:hotness:',
  CACHE_VIEWS_ARRAY: 'cache:views:array',
  CACHE_DATA_ARRAY: 'cache:data:array',
  CACHE_HASHMAP: 'cache:hashmap:map',
  CACHE_SIZE: 'cache:size',
};

export const MAX_CACHE_ENTRIES = 1000;
export const PROMOTION_THRESHOLD = 5;
export const CACHE_STATE_TTL = 86400;

export interface CacheEntry {
  views: number;
  uuid: string;
}
