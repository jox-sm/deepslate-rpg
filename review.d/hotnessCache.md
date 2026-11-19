# Review — `utilities/hotnessCache.ts` compaction

**Branch:** `refactor/compact-web` · **Status:** done (behavior-preserving)

## What moved where

Original 430-line `utilities/hotnessCache.ts` → a 14-line compatibility barrel plus a new
package `utilities/hotness/` (all modules well under the ~200-line budget):

| New module | Lines | Moved code (from HEAD) |
|---|---|---|
| `hotness/constants.ts` | 26 | `CACHE_KEYS`, `MAX_CACHE_ENTRIES`, `PROMOTION_THRESHOLD`, `CACHE_STATE_TTL`, `CacheEntry` interface, top-level JSDoc. Single immutable instance shared by reference. |
| `hotness/compression.ts` | 35 | `compressData`, `decompressData` (pako gzip/base64) |
| `hotness/hotness.ts` | 49 | `checkMemoryPressure`, `getHotness`, `incrementHotness` |
| `hotness/state.ts` | 70 | `binarySearchViews`, `loadCacheState`, `saveCacheState` (Redis state I/O) |
| `hotness/hit.ts` | 62 | `cacheHit` |
| `hotness/miss.ts` | 81 | `cacheMiss` |
| `hotness/queries.ts` | 86 | `getCachedGameData`, `getCacheStats`, `clearCache` |
| `hotness/index.ts` | 6 | Internal barrel (implementation re-exports) |

`utilities/hotnessCache.ts` is now a **14-line barrel** re-exporting all 10 original named
exports from `./hotness`. There was no default export and there are no `'use client'` /
`server-only` directives in the original — nothing to preserve there.

Dependency graph is one-way (no cycles): `constants` ← `compression`/`hotness`/`state` ←
`hit`/`miss`/`queries` ← `index` ← public barrel. Internal helpers that were module-private
(`binarySearchViews`, `loadCacheState`, `saveCacheState`) are now exported from `state.ts`
so siblings can import them, but are **not** re-exported from the public barrel — the public
surface is exactly the original 10 names.

## Import / boundary findings

- The file uses **absolute `@/` path aliases** for all external deps (`@/lib/queue`,
  `@/lib/retry`, `@/utilities/errorHandler`, `pako`). Moving one directory deeper therefore
  required **no relative-import rewrites** for those — only the new intra-package `./…`
  imports were added. This removed the most common split hazard.
- **No module-level mutable caches.** All cache state is external (Redis via `@/lib/queue`);
  the only module-level values are immutable constants and the `CacheEntry` type. Unlike the
  AI repo's mutable-dict cases, there is no shared-by-reference risk here. `CACHE_KEYS` lives
  in exactly one module and is imported by reference everywhere, so identity semantics are
  unchanged.
- Real code callers (grep of all `*.ts`): only `utilities/gameFetchPipeline.ts` imports the
  module (`getCachedGameData`, `cacheHit`, `cacheMiss` from `@/utilities/hotnessCache`) — the
  barrel keeps that path and those names intact (tsc confirms). `lib/cache-warmup.ts` imports
  the separate `hotnessCacheWithRetry.ts`, which is untouched and does **not** import this
  module. No `vi.mock`/`jest.mock` of `@/utilities/hotnessCache` anywhere.
- `documentations/issues/RedisHotnessCacheErrorHandling.md` shows a docs-only example import
  of `getCachedGameData` from the original path; still valid via the barrel. No code change.
- `@/utilities/errorHandler` is being split by a concurrent agent, but because all imports go
  through that stable path, this change does not couple to that work.

## Surprises

- The file is actually **430 lines** in this checkout, not 383 as noted in the skill/hand-off
  (docs quote ~384 too). Split logic was based on the real HEAD content.
- `utilities/hotnessCacheWithRetry.ts` duplicates the same `CACHE_KEYS` constants and
  `compressData`/`decompressData` implementations. Left as-is deliberately — deduplicating it
  would be a behavior-adjacent change outside this module's scope.
- `checkMemoryPressure()` is a hardcoded `return false` (memory-pressure guard is a no-op),
  preserved verbatim.

## Tests run + result

- **Baseline** `npx tsc --noEmit`: exactly 6 known errors (2 in
  `hooks/useIdempotentRequest.test.ts`, 4 in `lib/playClient.test.ts`).
- **After** `npx tsc --noEmit`: **identical output — the same 6 errors, zero new ones.**
- **Targeted vitest:** none exists — grep of all `*.test.ts`/`*.test.tsx` found **no test
  importing this module, its functions, or `gameFetchPipeline`**. No targeted suite to run;
  the orchestrator's centralized full-suite run is the integration check.
- **Mechanical-equivalence proof:** a token-level comparison (strip imports, `export`
  keywords and comments; normalize whitespace; sort tokens) of HEAD vs the 7 implementation
  modules yielded **1016 tokens on both sides, identical multiset — zero differences**. Every
  statement of every moved function/section is byte-equivalent; the only intentional changes
  are import lines, internal `export` markers, and relocated comments.

## Risks

- Low. Equivalence is proven at the token level and tsc matches baseline exactly.
- The only residual risk would be a runtime mock/spy that patches the **module object**
  `@/utilities/hotnessCache` by string path; grep found none, so no local-import indirection
  (needed in the AI repo's `flee`/`worldgen` cases) is required here.
- Barrel re-exports via `./hotness` directory index — resolved successfully by tsc under
  `moduleResolution: bundler` with the `@/* → ./*` alias.
