# Issue #84: GamePage: Create FullGameResponse type and UI components

## Status
✅ CLOSED

## Category
Feature, UI/UX

## Problem Description
The GamePage detail view needed a comprehensive type definition and UI component suite. The existing `GameDataJSON` type (`types/gamedata.ts`) only covered `{ id, characters, maps, items }` — missing flat fields from PostgreSQL (name, description, image, tags, likes_count, etc.). No UI components existed for rendering game detail sections.

## Note
Issue #83 is a duplicate of this issue (same title and description). This issue (#84) represents the implementation.

## Solution Implemented

### Types
Created `types/gameDetail.ts` with `FullGameResponse` interface merging flat PostgreSQL fields with nested MongoDB arrays:

```typescript
interface FullGameResponse {
  id: string;
  name: string;
  description: string;
  image: string;
  tags: string[];
  likes_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  characters: Character[];
  maps: Map[];
  items: Item[];
}
```

### UI Components

| Component | Purpose | States |
|-----------|---------|--------|
| `GameHeader` | Hero image, title, description, tags, meta | Shimmer skeleton → full hero |
| `CharacterCard` | Character portrait + name + description | Skeleton → fallback → loaded |
| `MapCard` | Map image + name + size + places | Skeleton → fallback → loaded |
| `ItemCard` | Item image + name | Skeleton → fallback → loaded |
| `GamePageError` | Full-page error with retry button | N/A → error → retry |

### Component Tree
```
GameDetailShell (Server)
  ├── Head metadata (SEO)
  └── Suspense → GamePageSkeleton
        └── GameDetailClient
              ├── GameHeader
              ├── CharactersSection → CharacterCard[]
              ├── MapsSection → MapCard[]
              └── ItemsSection → ItemCard[]
```

### Design
- Tailwind + shadcn primitives
- 8px grid system, mobile-first responsive
- Loading skeletons: `animate-pulse` shimmers matching component shape
- Error boundary wrapping each section for isolated failure recovery

## Files Created
- `types/gameDetail.ts` — `FullGameResponse` interface
- `app/game/[uuid]/page.tsx` — Server component shell
- `app/game/[uuid]/game-detail.tsx` — Client component
- `components/game/GameHeader.tsx` — Hero section
- `components/game/CharacterCard.tsx` — Character display
- `components/game/MapCard.tsx` — Map display
- `components/game/ItemCard.tsx` — Item display
- `components/game/GamePageError.tsx` — Error boundary with retry
- `components/game/GamePageSkeleton.tsx` — Loading skeleton

## Testing
- Render each component in isolation with mock data
- Verify skeleton shows during loading, content on success, error state on failure
- Test error boundary catches thrown errors and displays GamePageError with retry
- Responsive: mobile (<640px), tablet (640-1024px), desktop (1024px+)

## Verification Checklist
- [x] FullGameResponse type includes flat + nested fields
- [x] GameHeader shows hero image, title, description, tags, meta
- [x] CharacterCard shows portrait, name, description
- [x] MapCard shows image, name, size, places
- [x] ItemCard shows image, name
- [x] GamePageError shows error message + retry button
- [x] Loading skeletons shown during data fetch
- [x] Responsive layout at all breakpoints
- [x] Error boundary catches rendering errors per section


## Depends On
- [#80](80-GAMEPAGE-CARD-CLICK-NAVIGATION.md)
- [#82](82-GAMEPAGE-BATCH-MONGODB-FETCH.md)

## Blocks
- [#85](85-GAMEPAGE-RESPONSIVE-ACCESSIBILITY.md)

## Related Issues
- #80: Card click navigation with sessionStorage preload
- #81: Binary-search hotness cache
- #82: Batch MongoDB fetch via Redis queue
- #85: Responsive layout and accessibility verification
- #83: Duplicate of this issue
