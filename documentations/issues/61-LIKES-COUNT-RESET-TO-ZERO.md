# Issue #61: Likes count reset to 0 instead of using DB value

## Status
✅ CLOSED

## Category
Bug

## Problem Description

The `utilities/utils.ts` function always set `likes_count: 0` instead of retrieving the actual value from the database, causing likes to be lost.

### Code Example - Problem
```typescript
// Problem: Always resetting likes to 0
// utilities/utils.ts

export function formatGameData(dbGame: any) {
  return {
    id: dbGame.id,
    title: dbGame.title,
    description: dbGame.description,
    likes_count: 0,  // ❌ WRONG - always 0!
    // Should be: dbGame.likes_count || 0
  };
}

// Usage in route
const games = await db.query('SELECT * FROM games');
const formatted = games.map(formatGameData);

// Result: All games show 0 likes, actual count lost!
```

## Root Cause

Hardcoded default value instead of using database value:
- Copied `likes_count: 0` as default during development
- Never updated to use actual value
- Overwrites database data
- Data loss on every game fetch

## Why It's Critical

1. **Data Loss**: Actual likes count lost
2. **Wrong Display**: All games show 0 likes
3. **User Impact**: Likes feature broken
4. **Silent Failure**: No error thrown
5. **Confusion**: Inconsistent data

## Solution Implemented

**Use actual database value with fallback default:**

```typescript
// ✅ CORRECT: Use DB value with fallback
export function formatGameData(dbGame: any) {
  return {
    id: dbGame.id,
    title: dbGame.title,
    description: dbGame.description,
    likes_count: dbGame.likes_count || 0, // Use DB value, fallback to 0
    // ...other fields
  };
}

// Or with type safety
interface GameData {
  id: string;
  title: string;
  description: string;
  likes_count: number;
}

export function formatGameData(dbGame: any): GameData {
  return {
    id: dbGame.id,
    title: dbGame.title,
    description: dbGame.description,
    likes_count: Number(dbGame.likes_count) || 0, // Convert to number
  };
}

// Or more defensive
export function formatGameData(dbGame: any) {
  const likesCount = dbGame.likes_count;
  
  // Validate before using
  if (typeof likesCount !== 'number' || likesCount < 0) {
    console.warn(`Invalid likes_count for game ${dbGame.id}: ${likesCount}`);
    return { ...dbGame, likes_count: 0 };
  }
  
  return {
    ...dbGame,
    likes_count: likesCount
  };
}
```

## Best Practice Pattern

```typescript
// Helper for safe field extraction
function getSafeNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function formatGameData(dbGame: any) {
  return {
    id: String(dbGame.id),
    title: String(dbGame.title),
    description: String(dbGame.description),
    likes_count: getSafeNumber(dbGame.likes_count, 0),
    views_count: getSafeNumber(dbGame.views_count, 0),
    rating: getSafeNumber(dbGame.rating, 0),
  };
}

// Type-safe version
interface RawGameData {
  id: unknown;
  title: unknown;
  description: unknown;
  likes_count: unknown;
}

interface FormattedGameData {
  id: string;
  title: string;
  description: string;
  likes_count: number;
}

export function formatGameData(dbGame: RawGameData): FormattedGameData {
  return {
    id: String(dbGame.id),
    title: String(dbGame.title),
    description: String(dbGame.description),
    likes_count: getSafeNumber(dbGame.likes_count, 0),
  };
}
```

## Files Modified

- `utilities/utils.ts` - Fixed formatGameData function
- All routes using formatGameData - Now preserve likes count

## Testing

```typescript
describe('formatGameData', () => {
  test('should preserve likes_count from DB', () => {
    const dbGame = {
      id: '123',
      title: 'Test Game',
      likes_count: 42
    };
    
    const formatted = formatGameData(dbGame);
    expect(formatted.likes_count).toBe(42);
  });

  test('should default to 0 when likes_count missing', () => {
    const dbGame = {
      id: '123',
      title: 'Test Game'
      // no likes_count
    };
    
    const formatted = formatGameData(dbGame);
    expect(formatted.likes_count).toBe(0);
  });

  test('should handle null likes_count', () => {
    const dbGame = {
      id: '123',
      title: 'Test Game',
      likes_count: null
    };
    
    const formatted = formatGameData(dbGame);
    expect(formatted.likes_count).toBe(0);
  });

  test('should handle string likes_count from DB', () => {
    const dbGame = {
      id: '123',
      title: 'Test Game',
      likes_count: '42' // String from DB
    };
    
    const formatted = formatGameData(dbGame);
    expect(formatted.likes_count).toBe(42);
  });

  test('should handle invalid likes_count', () => {
    const dbGame = {
      id: '123',
      title: 'Test Game',
      likes_count: 'invalid'
    };
    
    const formatted = formatGameData(dbGame);
    expect(formatted.likes_count).toBe(0);
  });
});
```

## Data Recovery

If data was lost due to this bug:

```sql
-- Check for games with 0 likes
SELECT id, title, COUNT(likes) as actual_likes 
FROM games g
LEFT JOIN game_likes gl ON g.id = gl.game_id
WHERE g.likes_count = 0 AND COUNT(gl.id) > 0
GROUP BY g.id
ORDER BY COUNT(gl.id) DESC;

-- Update with correct counts
UPDATE games 
SET likes_count = (
  SELECT COUNT(*) 
  FROM game_likes 
  WHERE game_id = games.id
)
WHERE likes_count = 0;
```

## Before/After

| Scenario | Before | After |
|----------|--------|-------|
| Game has 42 likes | Shows 0 | Shows 42 ✓ |
| Game never liked | Shows 0 | Shows 0 ✓ |
| DB null | Shows 0 | Shows 0 ✓ |
| String value "42" | Shows 0 | Shows 42 ✓ |

## Verification Checklist

- [x] formatGameData uses DB value
- [x] Fallback to 0 when missing
- [x] Type conversion working
- [x] Tests passing
- [x] Likes count preserved
- [x] No more data loss

## Related Issues

- #39: Likes count reset to 0 instead of using DB value (duplicate)
- #12: Likes count reset to 0 instead of using DB value (duplicate)
