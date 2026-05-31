# Issue #55: Inadequate state management - 100% local state, no caching

## Status
✅ CLOSED

## Category
Refactor, Performance

## Problem Description

The application relied 100% on local component state (`useState`) with no server state caching, causing:

1. Repeated API requests for same data
2. Manual loading state management in every component
3. No data persistence across page navigations
4. Inefficient network usage

### Code Example - Problem
```tsx
// ❌ PROBLEM: Every component fetches independently

function GamesList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Every time component mounts, fetch again
    setLoading(true);
    fetch('/api/games')
      .then(r => r.json())
      .then(data => setGames(data))
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{games.map(g => <GameCard key={g.id} game={g} />)}</div>;
}

// Same list on different page
function Dashboard() {
  const [games, setGames] = useState([]); // Fetches again!
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setLoading(true);
    fetch('/api/games')
      .then(r => r.json())
      .then(data => setGames(data))
      .finally(() => setLoading(false));
  }, []);
  
  // Duplicate loading logic
  return <div>{games.map(g => ...)}</div>;
}

// Issues:
// 1. Each component fetches independently
// 2. Duplicate loading/error handling
// 3. No caching between navigations
// 4. Wasteful network requests
// 5. Inconsistent data
```

## Root Cause

Lack of centralized state management:
- No context API usage
- No query caching library (React Query, SWR)
- Treating data as local-only
- No distinction between local UI state and server state

## Why It's Critical

1. **Network**: Wasteful requests
2. **Performance**: Repeated loading states
3. **Data consistency**: Different components have different data
4. **UX**: Repeated loading screens
5. **Scalability**: Doesn't scale with app growth

## Solution Implemented

**Centralized server state management with caching:**

```tsx
// ✅ CORRECT: Using React Query for server state

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query hook
export function useGames() {
  return useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000 // Garbage collect after 10 minutes
  });
}

// Usage - Clean and simple
function GamesList() {
  const { data: games, isLoading, error } = useGames();
  
  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{games.map(g => <GameCard key={g.id} game={g} />)}</div>;
}

// Same query in different component - uses cache!
function Dashboard() {
  const { data: games, isLoading } = useGames();
  // No re-fetch if cached
  return <div>{games.map(g => <GameCard key={g.id} game={g} />)}</div>;
}

// ✅ CORRECT: Mutations with cache updates
export function useLikeGame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (gameId: string) => {
      const res = await fetch(`/api/games/${gameId}/like`, {
        method: 'POST'
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate cache, will re-fetch
      queryClient.invalidateQueries({ queryKey: ['games'] });
    }
  });
}

function GameCard({ game }) {
  const { mutate: like } = useLikeGame();
  
  return (
    <div>
      <h3>{game.title}</h3>
      <button onClick={() => like(game.id)}>Like</button>
    </div>
  );
}
```

## Architecture Pattern

```
Before (No caching):
Component A → fetch /api/games → State
Component B → fetch /api/games → State (different instance!)
Component C → fetch /api/games → State (another instance!)

After (Centralized caching):
Component A → useGames() → React Query Cache → fetch once
Component B → useGames() → React Query Cache (same!)
Component C → useGames() → React Query Cache (same!)
```

## Comprehensive Implementation

```tsx
// hooks/api/useGames.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useGames(page?: number, limit?: number) {
  return useQuery({
    queryKey: ['games', { page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page !== undefined) params.append('page', String(page));
      if (limit !== undefined) params.append('limit', String(limit));
      
      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000
  });
}

export function useGame(id: string) {
  return useQuery({
    queryKey: ['games', id],
    queryFn: async () => {
      const res = await fetch(`/api/games/${id}`);
      if (!res.ok) throw new Error('Failed to fetch game');
      return res.json();
    },
    staleTime: 10 * 60 * 1000
  });
}

export function useLikeGame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (gameId: string) => {
      const res = await fetch(`/api/games/${gameId}/like`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to like game');
      return res.json();
    },
    onSuccess: (_data, gameId) => {
      // Update both list and detail queries
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['games', gameId] });
    }
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (gameData: GameFormData) => {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      });
      if (!res.ok) throw new Error('Failed to create game');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
    }
  });
}

// Component usage
function GamesList() {
  const { data: games, isLoading, error, refetch } = useGames();
  const { mutate: likeGame, isPending: isLiking } = useLikeGame();
  
  return (
    <div>
      {isLoading && <Spinner />}
      {error && <Error error={error} />}
      {games?.map(game => (
        <GameCard
          key={game.id}
          game={game}
          onLike={() => likeGame(game.id)}
          isLiking={isLiking}
        />
      ))}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

## Files Modified

- Setup: Install `@tanstack/react-query`
- Created: `hooks/api/` - Query hooks
- Updated: All components using API data
- Setup: QueryClientProvider in layout

## Provider Setup

```tsx
// app/layout.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
```

## Testing

```typescript
describe('useGames', () => {
  test('should cache games across multiple calls', async () => {
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    
    const { result: result1, rerender } = renderHook(() => useGames(), { wrapper });
    await waitFor(() => expect(result1.current.isSuccess).toBe(true));
    
    const { result: result2 } = renderHook(() => useGames(), { wrapper });
    
    // Should use cache, data available immediately
    expect(result2.current.data).toEqual(result1.current.data);
  });

  test('should re-fetch after stale time', async () => {
    jest.useFakeTimers();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    
    const { result, rerender } = renderHook(() => useGames(), { wrapper });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    // Move time forward past stale time
    jest.advanceTimersByTime(6 * 60 * 1000);
    
    // Should refetch
    expect(result.current.isRefetching).toBe(true);
  });
});
```

## Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Requests for same data | N+1 | 1 (cached) | N times fewer |
| State management | Manual (complex) | Automatic | Simpler code |
| Data consistency | Can diverge | Single source | More reliable |
| Loading states | Duplicate | Automatic | Less code |

## Verification Checklist

- [x] React Query setup
- [x] All API queries use hooks
- [x] Caching working
- [x] Mutations invalidate cache
- [x] No duplicate fetches
- [x] Tests passing
- [x] DevTools shows cache

## Related Issues

- #33: Inadequate state management (duplicate)
- #22: Inadequate state management (duplicate)
