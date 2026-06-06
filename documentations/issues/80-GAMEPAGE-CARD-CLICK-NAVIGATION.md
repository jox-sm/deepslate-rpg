# Issue #80: GamePage: Add card click navigation with sessionStorage preload

## Status
✅ CLOSED

## Category
Feature, UI/UX

## Problem Description
ProfileCard on the homepage had no click handler. Clicking a card did nothing — users couldn't navigate to the game detail page. Additionally, navigating to the detail page required a full data fetch, leaving users staring at a blank loading skeleton while the API round-trip completed.

## Solution Implemented

### Card Click Navigation
When a user clicks ProfileCard:
1. Card data (name, description, image, tags, likes) stored in `sessionStorage` under key `game:{uuid}:card`
2. `router.push(/game/${uuid})` triggers instant navigation
3. `GameDetailClient` reads `sessionStorage` on mount for instant hero render
4. Background fetch fills in nested data (characters, maps, items)

### Key Files
- **`utilities/clientUtilities/useGameCache.ts`** — `useGamePreload()` hook reads preloaded card data from sessionStorage; `useGamePreloadStore()` provides `setPreload()`, `getPreload()`, `clearPreload()` utilities
- **`components/adventures/cards/cards-grid.tsx`** — Grid-level cache writes card data to sessionStorage on click

### SessionStorage Pattern
```typescript
// Save preload data on card click
const key = `game:${gameId}:card`;
sessionStorage.setItem(key, JSON.stringify(cardData));
router.push(`/game/${gameId}`);

// Read preload data on mount (GameDetailClient)
const stored = sessionStorage.getItem(key);
if (stored) render(JSON.parse(stored)); // instant hero section
```

## Files Modified
- `utilities/clientUtilities/useGameCache.ts` — `useGamePreload` + `useGamePreloadStore`
- `components/adventures/cards/cards-grid.tsx` — click handler with sessionStorage write
- `app/game/[uuid]/page.tsx` — GameDetailClient reads preload on mount

## Testing
- Click ProfileCard → verify sessionStorage set, router.push called
- Navigate to /game/[uuid] → verify initial render from sessionStorage (no loading flash)
- Refresh page (sessionStorage cleared on tab close) → verify graceful fallback to API fetch

## Verification Checklist
- [x] Click handler on ProfileCard
- [x] Card data stored in sessionStorage before navigation
- [x] GameDetailClient reads sessionStorage on mount for instant render
- [x] Fallback to full API fetch when sessionStorage is empty
- [x] sessionStorage cleared on tab close (no stale data)


## Depends On
— (none)

## Blocks
- [#81](81-GAMEPAGE-BINARY-SEARCH-HOTNESS-CACHE.md)
- [#82](82-GAMEPAGE-BATCH-MONGODB-FETCH.md)
- [#84](84-GAMEPAGE-FULLGAMERESPONSE-TYPE-UI.md)

## Related Issues
- #81: Binary-search hotness cache (next-tier caching)
- #82: Batch MongoDB fetch via Redis queue
- #84: FullGameResponse type and UI components
- #85: Responsive layout and accessibility verification
