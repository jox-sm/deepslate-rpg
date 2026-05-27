# Problems & Architectural Issues

---

## CRITICAL: Infinite Remount Loop (CardsGrid + page.tsx) - FIXED

**File:** `app/page.tsx:10-20` + `components/adventures/cards/cards-grid.tsx:42`

The root cause of the infinite re-render/refetch loop has been fixed by removing the `refreshKey` prop and `onRefresh` callback entirely. CardsGrid now manages its own lifecycle without requiring parent-driven remounts.

The fix involved:
1. Removing `refreshKey` state and `handleRefresh` function from `page.tsx`
2. Removing the `key={refreshKey}` prop from the `<CardsGrid>` component
3. Removing the `onRefresh` prop from `CardsGrid` component
4. Removing the `onRefresh` parameter from `CardsGridProps` type
5. Removing the `onRefresh` dependency from the `loadMore` useCallback
6. Removing the `if (onRefresh) onRefresh();` call in the `loadMore` function

---

## CardsGrid Flat Accumulation Not Working (Secondary Loop) - FIXED

**File:** `components/adventures/cards/cards-grid.tsx`

This issue has been resolved by stabilizing the `fetchGamesFromApi` function reference and simplifying the dependency array in the `useCallback` hook.

The fix involved:
1. Removing the `onRefresh` prop and related logic as described in the previous fix
2. Removing `onRefresh` from the `loadMore` useCallback dependencies
3. Further optimizing by removing `fetchCards` from the `loadMore` useCallback dependencies, leaving only `[batchSize]`
4. Since `fetchGamesFromApi` is imported from an external module and doesn't change between renders, it doesn't need to be in the dependency array

After these changes, the `loadMore` function reference remains stable across renders, eliminating the secondary loop path that was caused by the function being recreated on every render.

---

## Architectural Bloat — 4 Databases + 2 Auth Providers

The project uses multiple data systems for what it does:

| System | Purpose | Status |
|--------|---------|--------|
| **Convex** | Real-time backend, schema, queries | Has full CRUD for games/characters/maps/items — **unused by frontend** |
| **Neon PostgreSQL** | Game catalog (primary DB) | Used by `/api/games` REST routes |
| **MongoDB** | Extended game details | Characters, maps, items per game |
| **Redis** | Caching + job queues | 24h TTL cache + two queue processors |
| **Supabase** | Image storage | WebP conversion + upload |
| **Clerk** | Frontend auth | Active, wired to Convex |
| **Supabase Auth** | Dead code | `lib/middleware.ts`, `lib/server.ts`, `lib/client.ts` — none registered |

**Why this setup exists:** This is driven by **free tier constraints** — each service offers a generous free tier for a specific use case, so rather than pay for a single full-featured provider, the project distributes workloads across free tiers (Neon for relational, MongoDB for documents, Redis for caching/queues, Supabase for storage, Convex for real-time). All services are colocated in **US East**, so inter-service latency is negligible — every connection happens server-to-server within the same region, not through the client. The actual cost to the user is zero while getting the strengths of each specialized backend.

**Problems:**
- Convex CRUD (`convex/games.ts`, `convex/characters.ts`, etc.) is fully defined but **never called from the frontend**. The frontend uses `/api/games` REST endpoints instead.
- Supabase auth middleware at `lib/middleware.ts` is not in the root `middleware.ts` — **entirely dead code**.
- Data flows through 3+ storage systems for a single game creation (Redis queue → PostgreSQL → MongoDB), creating massive latency and failure surface.

---

## CSS & Layout Conflicts

### Body has `position: sticky`
**File:** `styles/layout/layout.module.css:12-14`

```css
.background {
  position: sticky;
  z-index: 0;
}
```

`position: sticky` on `<body>` is meaningless — the body IS the scroll container. Creates an unnecessary stacking context.

### Contradictory Body Heights
- `globals.css:11` — `body { height: 100%; }` (exact viewport)
- `layout.module.css:12` — `body { min-height: 100vh; }` (at least viewport)

`height: 100%` constrains body to exactly 100% of `<html>`. `min-height` is redundant and loses.

### Naked Body Flex Is Useless
**File:** `styles/layout/layout.module.css:8`

```css
.body { display: flex; }
```

Body has one effective child (`ConvexClientProvider` wrapper). A flex container with one child does nothing.

### Sidebar `overflow: hidden` Clips Content
**File:** `styles/sidebar/sidebar.module.css:22`

The sidebar clips any overflow content (dropdowns, tooltips) within its 172px width.

### Collapsed Menu Items Have 120px Bottom Margin
**File:** `styles/sidebar/sidebar.module.css:98,192`

`.menuItem` has `margin-bottom: 40px`, and `.collapsed .menuItem` adds another `margin-bottom: 5rem` (80px). Combined = 120px gap between collapsed items.

### Card Width Fights Grid Layout
**File:** `styles/cards/cards.module.css:2`

```css
.card { width: clamp(280px, 90%, 1200px); margin: 20px auto; }
```

Inside a 3-column grid with `gap: 1.5rem`, 90% width + auto margin fights the grid layout, creating uneven gaps.

### Orphaned CSS Module
**File:** `styles/auth/auth-gate.module.css`

Never imported by any component. Dead code.

---

## React Hook & Render Issues

### `fetchCards` Destabilizes `loadMore` Callback
**File:** `components/adventures/cards/cards-grid.tsx:30`

`loadMore` depends on `fetchCards` via `useCallback`. Since `fetchGamesFromApi` is defined as a new function every render in `page.tsx`, this cascades: parent re-render → new fetchCards → new loadMore → but ref pattern prevents effect re-run.

### No Scroll Throttle
**File:** `components/adventures/cards/cards-grid.tsx`

Scroll handler fires on every pixel scroll. No `requestAnimationFrame` or throttle. Fine for the guard ref, but unnecessary CPU work.

### `useCallback` Over-dependency on Form State
**File:** `components/adventures/form/form.tsx:28-117`

`handleFinalSubmit` depends on `form` (the full state object). Every keystroke creates a new `form` reference → callback recreated → child wizard re-renders on every keypress.

### Object URL Memory Leak
**File:** `ui/FormUI/imageComponent.tsx:38-39`

`URL.createObjectURL(file)` is never revoked with `URL.revokeObjectURL()`. Memory grows with each image upload attempt.

---

## Redis Queue Race Conditions

### Temp Key Collision
**File:** `utilities/db.ts:35`

```ts
const tempKey = `InsertGames:processing:${Date.now()}`;
```

Two queue processing runs in the same millisecond collide. Should use `crypto.randomUUID()`.

### Data Loss on Crash
**File:** `utilities/db.ts:38-47`

`redis.rename('InsertGames', tempKey)` + `del(tempKey)` pattern loses ALL queued data if the process crashes between rename and delete. The code comment on line 44 admits: "later we add a retry mechanism."

**Why this is acceptable for now:** Redis here only handles small queues — game creation is rare, and each queue item is tiny (URLs + small strings, ~100KB max per object). Even in a worst-case crash, the data loss is bounded to at most one game submission that was mid-flight. The actual game data (characters, maps, items arrays) is never stored solely in Redis — it passes through Redis queues and lands in PostgreSQL + MongoDB. With Cloudflare caching offering 1GB of cache space, static game assets and frequently accessed data are already cached at the edge. In the future, Gzip + compression libraries will shrink queue payloads further, making this even less of a concern.

### TOCTOU Race
**File:** `utilities/db.ts:91`

```ts
const length = await redis.llen('load');
return length > 0;
```

Between checking length and the next operation, another process can drain the queue.

### Hardcoded Sleeps
**File:** `lib/GamesInsert.ts:8,13`

```ts
await sleep(850);  // arbitrary delay
await sleep(150);  // second arbitrary delay
```

850ms + 150ms sleeps paper over race conditions instead of fixing them.

### Inconsistent Sorted Set Scores
**File:** `lib/cache-warmup.ts:94` vs `setGameInCache`

`warmUpCache` uses sequential integers (1, 2, 3...) as scores, while `setGameInCache` uses `Date.now()`. `getCachedGameIds` returns all sorted ascending, but the scores are inconsistent units → incorrect ordering.

---

## Dead & Unused Code

**Note:** Project is in early development — some dead code is expected scaffolding that will be wired up later. The items below are flagged so they don't accidentally get treated as active.

| File | Problem | Status |
|------|---------|--------|
| `convex/games.ts` | Full CRUD defined but never called from frontend | Scaffold — will be used when Convex is fully adopted |
| `convex/characters.ts` | Same — never called | Scaffold |
| `convex/maps.ts` | Same — never called | Scaffold |
| `convex/items.ts` | Same — never called | Scaffold |
| `lib/middleware.ts` | Supabase auth middleware in wrong location, never registered | Likely dead — Clerk replaced Supabase auth |
| `lib/server.ts` | Supabase server client — unused | Likely dead — same reason |
| `lib/client.ts` | Entirely commented out | Dead — remove |
| `styles/auth/auth-gate.module.css` | Orphaned CSS, never imported | Dead — remove |
| `components/background/profilemenu.tsx` | Need to verify if used | Needs audit |

---

## Data Inconsistencies

### Likes Count Reset to 0 - FIXED
**File:** `utilities/utils.ts:40`

This issue has been fixed by properly using the like count from the database when available, falling back to 0 only when the field is missing or null.

The fix involved changing line 40 in `utilities/utils.ts` from:
```ts
likes_count: 0,
```
to:
```ts
likes_count: game.likes_count ?? 0,
```

This ensures that if the database returns a `likes_count` value, it is used; otherwise, it defaults to 0.

### Field Name Mismatch Across Stack
- Convex schema: `likesCount` (camelCase)
- CardProps type: `likes_count` (snake_case)
- Neon DB: `likes_count` (snake_case)

Same concept, three different namings. The frontend never reads from Convex directly so the Convex field name doesn't matter for display, but it creates confusion.

---

## Security & Environment Issues

### Non-null Assertion on Env Var
**File:** `app/convex-client-provider.tsx:8`

```ts
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
```

If `NEXT_PUBLIC_CONVEX_URL` is missing, fails silently in production with a cryptic error.

### Uncamelcased Env Variable
**File:** `lib/queue.ts:4`

```ts
if (!process.env.redisqueue) throw new Error("REDIS_URL is missing!");
```

Checks for `redisqueue` but error says `REDIS_URL`. Convention-breaking lowercase name.

### Unsafe URL Construction in Sidebar
**File:** `components/background/slidebar.tsx:78`

```ts
href={item.label.toLowerCase() === "home" ? "/" : `${item.label.toLowerCase()}`}
```

No URL encoding — "My Profile" produces `/my profile` (invalid URL with space). Fragile string match — "homepage" would match the "home" check incorrectly.

---

## Duplicate & Conflicting Code - FIXED

### Two Nearly Identical Form Hooks
- `hooks/form.ts` — `useGameForm`, imports `@/types/form`
- `hooks/gameForm.ts` — `useGamesForm`, imports `@/types/gameForm`
- `lib/useGamesForm.ts` — re-exports from `hooks/gameForm.ts`

This issue has been fixed by creating a shared primitive hook `useFormState` that both form hooks now inherit from.

The fix involved:
1. Creating a new `hooks/useFormState.ts` file that contains the shared form logic (state management, field updates, reset, loading state)
2. Updating `hooks/form.ts` to use `useFormState` as its base, keeping only the `showWizard` and `resetCounter` state specific to the game form
3. Updating `hooks/gameForm.ts` to use `useFormState` as its base, keeping only the step management and character/map/item CRUD operations
4. Updating `lib/useGamesForm.ts` to use `useFormState` as its base (it was already a duplicate of `hooks/gameForm.ts`)

Now both form hooks share the common base implementation while maintaining their specific functionality, eliminating code duplication.

### Array Index as Key - FIXED
**File:** `components/adventures/cards/cards.tsx:43`, `components/background/slidebar.tsx:77`

This issue has been fixed by replacing array indices with stable unique identifiers as keys.

The fix involved:
1. In `components/adventures/cards/cards.tsx`: Changed `key={index}` to `key={tag}` in the tags mapping, using the tag string itself as a unique key
2. In `components/background/slidebar.tsx`: Changed `key={index}` to `key={item.label}` in the sidebar items mapping, using the label as a unique key

These changes ensure that React can correctly reconcile list items when they are reordered, filtered, or when the list contents change, preventing potential UI bugs and improving performance.

---

## Minor / Cosmetic - FIXED

- `sleep` defined in two places: `lib/GamesInsert.ts` and `utilities/pull.ts` — should be shared utility. **FIXED**: Created a shared `utilities/sleep.ts` utility and updated both files to import from it.
- `types/cards.ts` uses separate `export type` statements instead of inline `export`.
- Entire layout becomes effectively client-rendered because all children are `"use client"` — defeats App Router optimization.
- Sidebar auth status (`AuthStatus` in `components/authentication/auth-status.tsx`) is imported by nothing after being removed from sidebar.
