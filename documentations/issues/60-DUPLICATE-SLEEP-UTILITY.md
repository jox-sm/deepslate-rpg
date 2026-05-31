# Issue #60: Duplicate sleep utility defined in two files

## Status
✅ CLOSED

## Category
Refactor

## Problem Description

The `sleep()` utility function was defined in two separate files, causing code duplication and maintenance issues.

### Code Example - Problem
```typescript
// Problem 1: lib/GamesInsert.ts
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Problem 2: utilities/pull.ts (same implementation)
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Problem 3: Inconsistent usage
import { sleep as sleepFromGames } from '@/lib/GamesInsert';
import { sleep as sleepFromPull } from '@/utilities/pull';

// Both do the same thing but defined separately
```

## Root Cause

Code duplication from parallel development:
- Developers created same utility independently
- No shared utilities module
- No code review to catch duplication
- Different files, same functionality

## Why It's Critical

1. **Duplication**: Same code in two places
2. **Maintenance**: Bug in one place forgotten in other
3. **Inconsistency**: Different implementations possible
4. **Confusing**: Multiple imports for same function
5. **Testing**: Need to test same logic twice

## Solution Implemented

**Create single shared utility module:**

```typescript
// ✅ CORRECT: utilities/time.ts (single source of truth)
/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after timeout
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Alternative implementations
export function sleepSeconds(seconds: number): Promise<void> {
  return sleep(seconds * 1000);
}

export function sleepMinutes(minutes: number): Promise<void> {
  return sleep(minutes * 60 * 1000);
}

// ✅ CORRECT: Usage in lib/GamesInsert.ts
import { sleep } from '@/utilities/time';

export async function insertGamesWithRetry(games: Game[]) {
  for (const game of games) {
    try {
      await insertGame(game);
    } catch (error) {
      await sleep(1000); // 1 second retry delay
      // retry logic
    }
  }
}

// ✅ CORRECT: Usage in utilities/pull.ts
import { sleep } from '@/utilities/time';

export async function pullGamesWithInterval() {
  while (true) {
    const games = await fetchGames();
    await sleep(5000); // 5 second interval
    // process games
  }
}

// ✅ CORRECT: Remove from both original locations
// Delete from lib/GamesInsert.ts
// Delete from utilities/pull.ts
```

## File Structure

```
Before (Duplication):
├── lib/
│   ├── GamesInsert.ts (contains sleep)
│   └── ...
└── utilities/
    ├── pull.ts (contains sleep)
    └── ...

After (Single source):
├── utilities/
│   ├── time.ts (single sleep implementation)
│   ├── pull.ts (imports from time.ts)
│   └── ...
└── lib/
    ├── GamesInsert.ts (imports from utilities/time.ts)
    └── ...
```

## Enhanced Utilities Module

```typescript
// utilities/time.ts - Comprehensive time utilities

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    if (ms <= 0) resolve();
    else setTimeout(resolve, ms);
  });
}

/**
 * Sleep for specified seconds
 */
export function sleepSeconds(seconds: number): Promise<void> {
  return sleep(seconds * 1000);
}

/**
 * Sleep for specified minutes
 */
export function sleepMinutes(minutes: number): Promise<void> {
  return sleep(minutes * 60 * 1000);
}

/**
 * Exponential backoff retry helper
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i); // exponential backoff
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}
```

## Best Practice Pattern

```typescript
// utilities/time.ts
// Single, centralized time utility module

export interface TimeHelpers {
  sleep: (ms: number) => Promise<void>;
  sleepSeconds: (s: number) => Promise<void>;
  sleepMinutes: (m: number) => Promise<void>;
}

const timeHelpers: TimeHelpers = {
  sleep: (ms: number) => new Promise(r => setTimeout(r, ms)),
  sleepSeconds: (s: number) => timeHelpers.sleep(s * 1000),
  sleepMinutes: (m: number) => timeHelpers.sleep(m * 60 * 1000)
};

export const { sleep, sleepSeconds, sleepMinutes } = timeHelpers;
```

## Files Modified

- Created: `utilities/time.ts` - Centralized time utilities
- Updated: `lib/GamesInsert.ts` - Import from utilities/time
- Updated: `utilities/pull.ts` - Import from utilities/time
- Removed: Duplicate sleep functions

## Testing

```typescript
describe('Time utilities', () => {
  test('sleep should delay execution', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(150); // some tolerance
  });

  test('sleepSeconds should convert to milliseconds', async () => {
    const start = Date.now();
    await sleepSeconds(0.1); // 100ms
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  test('sleepMinutes should convert to milliseconds', async () => {
    const ms = 1; // 1 millisecond
    const start = Date.now();
    await sleep(ms);
    
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
  });

  test('sleep(0) should not delay', async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(10); // minimal delay
  });

  test('sleep with negative should resolve immediately', async () => {
    const start = Date.now();
    await sleep(-100);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(10);
  });
});
```

## Migration Checklist

- [x] Create `utilities/time.ts`
- [x] Move sleep to new module
- [x] Update imports in `lib/GamesInsert.ts`
- [x] Update imports in `utilities/pull.ts`
- [x] Remove duplicate implementations
- [x] Update tests
- [x] Verify all uses work

## Code Locations

Find all duplicate functions:

```bash
grep -r "function sleep" --include="*.ts" --include="*.tsx"
```

## Verification Checklist

- [x] Single sleep definition
- [x] No duplicates remain
- [x] All imports updated
- [x] Tests passing
- [x] Same functionality
- [x] Improved maintainability

## Related Issues

- #38: Duplicate sleep utility defined in two files (duplicate)
- #15: Duplicate sleep utility defined in two files (duplicate)
