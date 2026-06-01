# Issue #52: Component coupling and reusability issues

## Status
✅ CLOSED

## Category
Refactor

## Problem Description

Components had moderate coupling with some being tightly tied to specific pages, reducing reusability across the application.

### Solution Implemented

**Decouple components for reusability:**

```jsx
// ❌ BEFORE: Tightly coupled
function GameList() {
  const router = useRouter(); // Specific to pages
  const [games, setGames] = useState([]);
  
  return (
    <div>
      {games.map(g => (
        <div
          key={g.id}
          onClick={() => router.push(`/games/${g.id}`)} // Hardcoded nav
        >
          {g.title}
        </div>
      ))}
    </div>
  );
}

// ✅ AFTER: Decoupled and reusable
interface GameListProps {
  games: Game[];
  onGameClick?: (game: Game) => void;
  isLoading?: boolean;
}

function GameList({ games, onGameClick, isLoading }: GameListProps) {
  if (isLoading) return <Spinner />;
  
  return (
    <ul role="list">
      {games.map(g => (
        <li key={g.id} onClick={() => onGameClick?.(g)}>
          {g.title}
        </li>
      ))}
    </ul>
  );
}

// Wrapper for page-specific behavior
export function GameListPage() {
  const router = useRouter();
  const { data: games } = useGames();
  
  return (
    <GameList
      games={games || []}
      onGameClick={(game) => router.push(`/games/${game.id}`)}
    />
  );
}
```

## Files Modified

- Refactored all tightly coupled components
- Extracted logic into separate layers
- Created reusable component primitives

## Benefits

- Reusable across pages
- Easier testing
- Better separation of concerns
- Flexible prop interface

## Verification Checklist

- [x] Components decoupled
- [x] No hardcoded logic
- [x] Prop interfaces flexible
- [x] Reusable across app
- [x] Tests passing

## Related Issues

- #31: Component coupling and reusability (duplicate)
- #24: Component coupling and reusability (duplicate)
