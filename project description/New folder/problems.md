# Problems & Architectural Issues

## Architecture Overview — Intentional Free-Tier Optimization

The project uses multiple specialized data systems, each selected for its specific strengths within generous free tiers:

| System | Purpose | Status | Optimization Rationale |
|--------|---------|--------|------------------------|
| **Convex** | Real-time backend, schema, queries | Has full CRUD for games/characters/maps/items — **provides schema validation and backend auth integration** | Real-time capabilities ready for future implementation |
| **Neon PostgreSQL** | Game catalog (primary DB) | Used by `/api/games` REST routes | Optimized for relational queries, efficient indexing, ACID transactions for game metadata |
| **MongoDB** | Extended game details | Characters, maps, items per game | Flexible document storage ideal for variable JSON game assets (characters, maps, items) |
| **Redis** | Caching + job queues | 24h TTL cache + two queue processors | Low-latency caching for frequent reads, efficient queue buffering for request smoothing |
| **Supabase** | Image storage | WebP conversion + upload | Specialized media storage with CDN integration, optimized for binary blobs |
| **Clerk** | Frontend auth | Active, wired to Convex | Robust authentication management with social login, session handling |
| **Supabase Auth** | Dead code | `lib/middleware.ts`, `lib/server.ts`, `lib/client.ts` — none registered | Legacy from evaluation phase — Clerk selected as superior auth solution |

**Architecture Motivation**: This represents an intentional cost-optimization strategy where each service handles workloads it's best suited for within free tiers:
- **Neon PostgreSQL**: Efficient for structured, query-heavy game catalog data
- **MongoDB**: Optimal for flexible, evolving document structures (game assets with varying schemas)
- **Redis**: Superior for high-frequency operations (caching, queuing) with sub-millisecond latency
- **Supabase**: Specialized for media storage (more cost-effective than general-purpose DBs for blobs)
- **Convex**: Available for real-time features when needed (currently unused by frontend)
- **Clerk**: Selected over Supabase Auth for better developer experience and features

**Operational Considerations** (to address rather than architectural flaws):
- Supabase auth middleware at `lib/middleware.ts` is not in the root `middleware.ts` — **inactive code**
- Data flows through multiple systems for a single game creation (Redis queue → PostgreSQL → MongoDB), creating operational complexity
- Missing operational fundamentals: no tests, error monitoring, logging, input validation beyond basic pattern checks
- Connection management: manual database connections, no pooling mechanism
- Inconsistent caching: cache-aside pattern without write invalidation, leading to stale data
- Environment variable issues: non-null assertions that could fail silently, inconsistent naming conventions
- Unsafe URL construction in sidebar: no URL encoding, fragile string matching
- Dead/unused code: orphaned CSS modules, commented-out files, unused Convex CRUD operations

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

---

## Supabase Image Storage Issues

### No Retry Mechanism on Supabase Operations
**File:** `lib/storage.ts:15`
**Problem:** The `uploadImage` function throws errors immediately without retry logic, unlike database and Redis operations which use `lib/retry.ts`. Network blips during image upload cause permanent failures.
solution: add retry logic from utilities

### Batch Upload Has No Error Isolation
**File:** `utilities/insertGameImages.ts:5-30`
**Problem:** Uses `Promise.all` for character, map, and item image uploads. A single failed image upload (e.g., corrupted file, network issue) fails the entire batch, preventing all images from being processed.
Explanation: `Promise.all` rejects immediately when any of the promises rejects. This means if uploading one character's image fails, none of the maps or items images will be uploaded, even if they would succeed. We need to handle errors individually for each upload type so that successes in one category don't fail because of failures in another.
sollution: Replace `Promise.all` with individual error handling for each array (characters, maps, items) using `map` with try/catch or similar error isolation techniques. Each upload category should be processed independently so failures in one don't block others.


### Missing Image Error Handling in UI
**File:** `components/adventures/cards/cards.tsx:22-26`
**Problem:** `<img>` tags have no `onError` handler or fallback image. If a Supabase image URL returns 403/404 (bucket not public, file deleted, etc.), users see broken images with no recovery.
sollution:if image crashes or anything crash remove the entire card data from being displayed and remove it from reddis cache


### Supabase Client Created with Non-null Assertions
**File:** `lib/supabase.ts:10-14`
**Problem:** Uses `supabaseUrl!` and `supabaseKey!` non-null assertions. If environment variables are missing at runtime, the client is created with `undefined` values, causing silent failures.
sollution: this is a production Beta which won't happen anytime soon no need to worry about it


### Supabase Auth Code Is Dead/Unused
**File:** `lib/middleware.ts`, `lib/server.ts`, `lib/client.ts`
**Problem:** Supabase authentication middleware and client code exists but is unused (Clerk selected as auth solution). Creates confusion and maintenance overhead.
sollution:use jwt tokens of clerk+convex with supabase , neon , and other services
this creates a highly secured enviroment and ofc remove supabase authentication logic from the codebase


### Image Upload Pipeline Uses Inefficient Data URL Conversion
**File:** `utilities/insertGameImages.ts:40-44`
**Problem:** Converts base64 data URLs → Buffer via `fetch()` → `arrayBuffer()`. Works but inefficient for large images due to double serialization (base64 → binary → base64 → binary).
Explanation: The current flow converts File objects to base64 strings on the client, sends them as JSON strings to the API, then converts them back to binary Buffers via fetch() and arrayBuffer(). This means binary image data gets base64-encoded (increasing size by ~33%), sent as text in JSON, then decoded back to binary. For large images, this creates unnecessary CPU overhead and increases network payload size.
sollution: convert image into binary directly and send it into api as json blob which is more efficient

### Public URL Generation Doesn't Verify Bucket Access
**File:** `node_modules/@supabase/storage-js/dist/index.d.cts:1438-1446` (via docs)
**Problem:** `getPublicUrl()` constructs URLs without verifying the bucket is public. If `deepslate-rpg` bucket lacks public access, images will 404/403 despite returning valid-looking URLs.
sollution: bucket is public without verification

### No Image Upload Progress or Cancellation Support
**Files:** `lib/storage.ts`, `app/api/convertUrl/route.ts`, `app/api/convertUrl/ConvertGameImages/route.ts`
**Problem:** Uploads provide no progress feedback and cannot be cancelled, leading to poor UX on slow connections.
sollution: add those operations into @/utilities/imagesUtils.ts and use it into the components and apis(if anything is unclear about it write an explination and i will provide what you need)

### No CDN Cache Control on Uploaded Images
**File:** `lib/storage.ts:10-13`
**Problem:** Uploads use default cache control. No ability to set custom `Cache-Control` headers for performance tuning.
sollution: add explanation first for this promblem so i can understand.

### Supabase Storage Bucket Name Hardcoded
**Files:** Multiple files reference `'deepslate-rpg'` directly
**Problem:** Bucket name is hardcoded in multiple places, making it difficult to change or configure per environment.
sollution: add a env variable for bucket name

### supabase doesn't work
problem: supabase storage doesn't accept any image or allow downloading any images
sollution: go to supabase dashboard and do resume project (solved this problem)