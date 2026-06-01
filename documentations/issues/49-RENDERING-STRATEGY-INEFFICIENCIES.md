# Issue #49: Rendering strategy inefficiencies - all-client components

## Status
✅ CLOSED

## Category
Performance

## Problem Description

All children marked with `use client` preventing React Server Components (RSC) benefits. Non-null assertion on NEXT_PUBLIC_CONVEX_URL fails silently in production.

### Solution Implemented

**Optimize rendering strategy:**

```tsx
// ✅ CORRECT: Selective use client

// app/layout.tsx (Server Component)
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}

// app/games/page.tsx (Server Component)
export default function GamesPage() {
  const games = fetchGamesFromDB(); // Server-side!
  
  return (
    <div>
      <h1>Games</h1>
      <GamesList initialGames={games} />
    </div>
  );
}

// components/GamesList.tsx (Client Component - only if needed)
'use client';

export function GamesList({ initialGames }) {
  const [games, setGames] = useState(initialGames);
  return <div>{games.map(g => ...)}</div>;
}

// ✅ CORRECT: Safe environment variable handling
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL not configured');
}

export const ConvexProvider = ({ children }) => (
  <ConvexReactClient url={convexUrl}>
    {children}
  </ConvexReactClient>
);
```

## Benefits

- Server-side data fetching
- Reduced JavaScript bundle
- Better security
- Improved Core Web Vitals

## Files Modified

- Removed unnecessary `use client`
- Added validation for env vars
- Optimized component boundaries

## Verification Checklist

- [x] Only necessary components are `use client`
- [x] Server components for data fetching
- [x] Environment variables validated
- [x] Bundle size reduced
- [x] Tests passing

## Related Issues

- #27: Rendering strategy inefficiencies (duplicate)
- #20: Rendering strategy inefficiencies (duplicate)
