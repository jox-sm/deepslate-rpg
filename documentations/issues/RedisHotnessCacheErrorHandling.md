# Redis Hotness Cache Error Handling

This document explains how to handle Redis hotness cache errors in the Deepslate Dungeons application.

## Overview

The Redis hotness cache provides a two-tier caching system for game data:

1. **Hotness Map**: Tracks access frequency for games NOT in the main cache
2. **Sorted Cache**: Top N most-viewed games, sorted by views descending

When Redis operations fail after all retries, the application now displays the `RedisHotnessCacheErrorPage` instead of just showing "no games".

## Error Handling Implementation

### 1. Error Page Component

The `RedisHotnessCacheErrorPage` is located at `exceptions/errorPages/redis-hotness-cache.tsx` and provides:

- **Status Code**: 503 (Service Unavailable)
- **Title**: "Cache service unavailable"
- **Message**: Explains that the hotness cache service is temporarily unavailable due to Redis connection issues
- **Actions**: 
  - "Try again" - Reloads the page
  - "Return home" - Navigates to the homepage

### 2. Error Handler Component

The `RedisHotnessCacheErrorHandler` is located at `components/errors/RedisHotnessCacheError.tsx` and can be used in your application to display the error page.

## Usage Examples

### In a React Component

```tsx
import { RedisHotnessCacheErrorHandler } from '@/components/errors/RedisHotnessCacheError';

function GamePage() {
  const [cacheError, setCacheError] = useState(false);

  const loadGameData = async () => {
    try {
      const data = await getCachedGameData(gameId);
      if (data) {
        setGameData(data);
      } else {
        // Fallback to API call
        const apiData = await fetchGameFromAPI(gameId);
        setGameData(apiData);
      }
    } catch (error) {
      // Redis hotness cache failed after retries
      setCacheError(true);
      console.error('Hotness cache error:', error);
    }
  };

  if (cacheError) {
    return <RedisHotnessCacheErrorHandler />;
  }

  return (
    <div>
      {/* Game content */}
    </div>
  );
}
```

### In a Custom Hook

```tsx
import { useState, useEffect } from 'react';
import { getCachedGameData } from '@/utilities/hotnessCache';

export function useGameWithHotnessCache(gameId: string) {
  const [gameData, setGameData] = useState(null);
  const [cacheError, setCacheError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const cachedData = await getCachedGameData(gameId);
        if (cachedData) {
          setGameData(cachedData);
        } else {
          // Fallback to API
          const apiData = await fetchGameFromAPI(gameId);
          setGameData(apiData);
        }
      } catch (error) {
        setCacheError(true);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [gameId]);

  return { gameData, cacheError, loading };
}
```

## Error Scenarios

### 1. Redis Connection Failure

When Redis is unavailable or the connection is lost:

- The hotness cache will retry 3 times with exponential backoff
- If all retries fail, the `RedisHotnessCacheErrorPage` is displayed
- Users can retry or return home

### 2. Redis Operation Timeout

When Redis operations take too long:

- The retry mechanism will handle timeouts
- After all retries fail, the error page is shown
- Users can retry to attempt the operation again

### 3. Redis Memory Pressure

When Redis memory is low:

- The cache will skip promotion of new entries
- If critical operations fail, the error page is displayed
- Users are informed about the temporary service issue

## Integration Points

### Hotness Cache Functions

The following functions now include proper error handling:

- `getHotness()` - Gets hotness count for a UUID
- `incrementHotness()` - Increments hotness count
- `cacheHit()` - Handles cache hits
- `cacheMiss()` - Handles cache misses
- `getCachedGameData()` - Retrieves cached game data
- `getCacheStats()` - Gets cache statistics
- `clearCache()` - Clears all cache data

### Cache Warm-up Functions

The following functions now include proper error handling:

- `checkCachePrimed()` - Checks if cache is primed
- `setCachePrimed()` - Sets cache as primed
- `getCachedGameIds()` - Gets cached game IDs
- `getGameFromCache()` - Gets game from cache
- `setGameInCache()` - Sets game in cache

## Testing

To test the Redis hotness cache error handling:

1. Simulate Redis connection failure by stopping the Redis service
2. Attempt to access a game that would use the hotness cache
3. Verify that the `RedisHotnessCacheErrorPage` is displayed
4. Test the "Try again" button to reload the page
5. Test the "Return home" button to navigate to the homepage

## Best Practices

### 1. Graceful Degradation

Always provide a fallback when the hotness cache is unavailable:

```tsx
const loadGameData = async () => {
  try {
    const cachedData = await getCachedGameData(gameId);
    if (cachedData) {
      setGameData(cachedData);
      return;
    }
  } catch (error) {
    console.error('Hotness cache error:', error);
  }

  // Fallback to API call
  const apiData = await fetchGameFromAPI(gameId);
  setGameData(apiData);
};
```

### 2. Error Logging

Log Redis hotness cache errors for debugging:

```tsx
const loadGameData = async () => {
  try {
    const cachedData = await getCachedGameData(gameId);
    if (cachedData) {
      setGameData(cachedData);
    }
  } catch (error) {
    console.error('Redis hotness cache error for game', gameId, ':', error);
    setCacheError(true);
  }
};
```

### 3. User Experience

Provide clear feedback to users when the cache is unavailable:

- Display the error page with a helpful message
- Offer retry functionality
- Provide navigation to the homepage
- Consider implementing a notification system for cache issues

## Migration Guide

### From Previous Version

If you were previously handling Redis hotness cache errors manually:

**Before:**

```tsx
try {
  const data = await getCachedGameData(gameId);
  if (data) {
    setGameData(data);
  }
} catch (error) {
  // Just show no games
  setGameData(null);
}
```

**After:**

```tsx
import { RedisHotnessCacheErrorHandler } from '@/components/errors/RedisHotnessCacheError';

function GamePage() {
  const [cacheError, setCacheError] = useState(false);

  const loadGameData = async () => {
    try {
      const data = await getCachedGameData(gameId);
      if (data) {
        setGameData(data);
      }
    } catch (error) {
      setCacheError(true);
    }
  };

  if (cacheError) {
    return <RedisHotnessCacheErrorHandler />;
  }

  return (
    <div>
      {/* Game content */}
    </div>
  );
}
```

## Troubleshooting

### Common Issues

1. **Redis not running**: Ensure Redis service is running
2. **Redis credentials**: Verify Redis credentials are correct
3. **Network connectivity**: Check network connectivity to Redis
4. **Memory pressure**: Monitor Redis memory usage

### Debugging

To debug Redis hotness cache errors:

1. Check the browser console for error messages
2. Look at the application logs for Redis error details
3. Verify Redis connection settings
4. Test Redis connectivity manually

## Conclusion

The Redis hotness cache error handling implementation provides a robust solution for handling Redis failures. By displaying the `RedisHotnessCacheErrorPage` when all retries fail, users are informed about the issue and provided with options to retry or navigate to the homepage. This approach ensures a better user experience and provides clear feedback when the cache service is unavailable.