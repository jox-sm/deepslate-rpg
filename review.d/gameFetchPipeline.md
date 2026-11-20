# Compaction review — `utilities/gameFetchPipeline.ts`

Branch `refactor/compact-web`. Behavior-preserving split of the batch game fetch
pipeline (Redis queue + Neon/MongoDB batch processor) into a focused package behind
a compatibility barrel. No git add/commit performed.

## What moved where

Original single file (350 lines in HEAD — see Surprises) → new package + barrel:

| Target file | Lines | Contents (all moved verbatim from HEAD) |
|---|---|---|
| `utilities/gameFetchPipeline.ts` (rewritten) | 12 | **Compatibility barrel.** Re-exports the 7 public functions from the three implementation modules. Keeps the original header doc comment (plus a barrel note). |
| `utilities/gameFetch/common.ts` | 32 | Private constants `QUEUE_KEYS`, `BATCH_SIZE`, `BATCH_TIMEOUT_MS` and interfaces `FetchRequest`, `FullGameData`. |
| `utilities/gameFetch/enqueue.ts` | 48 | `queueGameFetch`, `getQueueStats`, `clearQueue` (queue control / Redis LPUSH/LLEN/DEL). |
| `utilities/gameFetch/processor.ts` | 142 | `processBatch` (the large tiered-lookup batch processor; unchanged, including the LPOP-count fix and all error-classification/log strings). |
| `utilities/gameFetch/results.ts` | 99 | `getFetchResult`, `waitForFetchResult`, `getGameWithBatchQueue` (result read / poll / convenience wrapper). |

Public exports preserved from the original path (all 7, no default export existed):
`queueGameFetch`, `processBatch`, `getFetchResult`, `waitForFetchResult`,
`getGameWithBatchQueue`, `getQueueStats`, `clearQueue`.

Internal dependency graph is one-way, no cycles:
`common` ← `enqueue` ← `results`; `common` ← `processor`; barrel re-exports all three.
`getGameWithBatchQueue` still calls the real `queueGameFetch`, now imported from
`./enqueue` (see Risks).

## Import / boundary findings

- **All original imports are `@/` path-alias imports** (`@/lib/queue`, `@/lib/db`,
  `@/models/...`, `@/lib/retry`, `@/utilities/errorHandler`,
  `@/utilities/hotnessCache`). There were **no relative imports** in the source
  file, so moving into a subfolder required **no `./x` → `../x` rewrites**; the alias
  resolves identically from any depth. New sibling imports use `./common`,
  `./enqueue` etc.
- **Server-only module stays server-only.** The pipeline touches Redis (via
  `lib/queue`), Neon (via `lib/db`) and MongoDB (`@/models/games/mongodb/*`).
  Its only code callers are server contexts and all import the unchanged path:
  - `app/api/games/batch-queue/route.ts` → `queueGameFetch`
  - `app/api/games/batch-result/[requestId]/route.ts` → `getFetchResult`
  - `lib/workers.ts` → `getQueueStats`, `processBatch`
  No `'use client'` directive existed or was added; no client component imports
  this module. Barrel + submodules remain server-only.
- The private `QUEUE_KEYS`/constants/interfaces are `export`ed from `common.ts`
  only so siblings share the *same single objects*; they are deliberately **not**
  re-exported from the barrel, so the public surface is unchanged (verified below).
- Docs (`README.md`, `documentations/**`, `legacy-documentations/**`, SKILL.md,
  review.md) and `graphify-out/**` mention the old path in prose only — not code,
  so no edits were needed (and were out of scope).

## Surprises

- **Line count mismatch:** the task/SKILL.md cite 306 lines; `git show
  HEAD:utilities/gameFetchPipeline.ts` and the working tree actually contain
  **350 lines** (`git diff HEAD -- utilities/gameFetchPipeline.ts` was empty before
  the change, so working tree == HEAD). `Measure-Object -Line` reports 306 because
  it does not count the final unterminated line the same way — the real content is
  350 lines. Transcribed from the full file content, not the stale number.
- The file has **no default export** and no tests/mocks reference it. No
  string-path monkeypatch concern (unlike some AI-repo splits): nothing does
  `vi.spyOn(gameFetchPipeline, ...)` or patches by name.

## Tests run + result

- **Byte-identity harness** (temporary Node script, outside the repo): extracted
  all 7 function bodies and all 5 shared declarations from
  `git show HEAD:...` and from the new modules, normalized line endings + leading
  indent, and compared. **All 12 comparisons `OK`**; barrel confirmed to export
  exactly the 7 public names and to **not** leak the 5 private ones. Result:
  `ALL MOVES BYTE-IDENTICAL + BARREL CORRECT`.
- **`npx tsc --noEmit`:** exactly the **6 known baseline errors**
  (2 in `hooks/useIdempotentRequest.test.ts`, 4 in `lib/playClient.test.ts`),
  **zero new errors** — matches the pre-change baseline captured before editing.
- **Targeted vitest:** none to run. `*.test.ts` / `*.test.tsx` / `*.spec.*` search
  found **no test covering this pipeline**, and no test imports any of its exports
  (grep across all `.ts`). Full suite intentionally not run (orchestrator does it
  centrally); tsc module resolution covers the three real callers.
- Line budgets: barrel 12 (≤30), all modules ≤142 (≤200).

## Risks

- **Internal call indirection:** `getGameWithBatchQueue` in `results.ts` now calls
  `queueGameFetch` imported from `./enqueue` rather than a same-file binding. Since
  nothing mocks/patches the module and there are no module-level side effects, this
  is behavior-neutral. If a future test spies on the barrel's `queueGameFetch`, the
  internal call would bypass it — worth noting for future test authors, not a
  current regression.
- **Module load graph:** importing only `getFetchResult` now also evaluates
  `enqueue.ts` (it imports redis/retry). These modules have no top-level side
  effects, so no observable change; all three anyway share the same redis imports.
- No server/client or env-boundary changes; no behavior, log string, retry count,
  TTL (`ex: 3600`), batch size/timeout, or error-classification context strings
  were altered.
