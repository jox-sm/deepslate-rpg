# Refactor Review — Deepslate Dungeons web project (COMPACTED ✅)

**Project:** `D:\deepslate dungeons` (Next.js 16 / React 19 / TS), branch `refactor/compact-web`.
**Goal:** compact the codebase into small files with **zero behavior change** (see `.agents/skills/clean-architecture/SKILL.md`).
**Result:** `npm test -- --run` → **113/113 passed**; `npx tsc --noEmit` → exactly **6 known baseline errors** (2 in `hooks/useIdempotentRequest.test.ts`, 4 in `lib/playClient.test.ts`), zero new ones.

> Subagents wrote raw notes into `review.d/*.md`. This is the merged conversation.

## Safety net
```
main                         old committed state, untouched
checkpoint/pre-refactor-web  all prior work (saves vault, relays, Docker, docs)
refactor/compact-web         all compaction commits
```

## Agent round-table

### 🚨 errorHandler agent — `utilities/errorHandler.ts` (494 → 16-line barrel)
- `utilities/error/`: `classifyStatus.ts` (109), `classify.ts` (119), `toast.ts` (27), `mapToComponent.ts` (87), `wrappers.ts` (111), `helpers.ts` (52) — all ≤111 lines.
- **Insight:** the 103-line status `switch` was lifted verbatim into `classifyStatusError` to fit the budget; all 16 exports preserved; `@/` aliases meant no relative-path rewrites; no `'use client'` directive existed.
- **Verification:** 6/6 tests; **5/5 differential checks** (all exports/statuses/messages/contexts); tsc clean vs baseline.
- **Curiosity:** PowerShell mangled an em-dash in the diff oracle (`—` → `ΓÇö`) — shipped file has the correct character.

### 🔥 hotnessCache agent — `utilities/hotnessCache.ts` (430 actual, not 383 → 14-line barrel)
- `utilities/hotness/`: `constants` (26), `compression` (35), `hotness` (49), `state` (70), `hit` (62), `miss` (81), `queries` (86), `index` (6).
- **Insight:** **no module-level mutable caches** (state lives in Redis); all 10 named exports preserved, 3 private helpers kept internal. `hotnessCacheWithRetry.ts` duplicates logic but was left untouched deliberately (out of scope).
- **Verification:** token-level equivalence → **1016 tokens both sides, identical multiset**; tsc baseline exact.

### 📦 gameFetch agent — `utilities/gameFetchPipeline.ts` (350 actual → 12-line barrel)
- `utilities/gameFetch/`: `common` (32), `enqueue` (48), `processor` (142), `results` (99).
- **Insight:** server-only file (Redis/Neon/Mongo); all 3 callers are server routes/workers importing the unchanged path; no client code or tests touch it, no default export / no monkeypatch hazard.
- **Verification:** byte-identity of 7 functions + 5 declarations; barrel exposes exactly the 7 public names; tsc baseline exact.

### 🎮 PlayScreen agent — `components/game/PlayScreen.tsx` (360 → 66)
- `components/game/play/`: `usePlaySession.ts` (200) — session state/refs/polling/autosave/send, `useSaveControls.ts` (91) — router/save/exit, plus `PlayHeader`, `StoryPanel`, `MoveInput`, `ExitModal`, `constants.ts`, `types.ts`.
- **Insight:** `useRouter()` stayed unconditional during render so hook order and the
  test mock still work; `turnRef` shared by reference via structural
  `{ current: number }`; error strings and timestamp/skew detection carried over
  verbatim; unused `logRef` preserved for DOM fidelity.
- **Verification:** 4/4 PlayScreen tests; tsc baseline exact.

### ⚙️ workers (orchestrator work, not an agent) — `lib/workers.ts` (273 → 3-line barrel)
- `lib/workers/`: `config.ts` (41), `state.ts` (60), `ticks.ts` (57), `runner.ts` (123).
- **Critical invariant:** global singleton on `globalThis.__deepslate_workers__` survives HMR without orphan timers — kept in ONE module imported by everyone, identity preserved.
- Moving previously private types/constants across modules required adding `export` (TS2459/TS7053 caught each); after that, tsc baseline exact.

## Shared lessons
1. This repo uses `@/` absolute imports everywhere — nesting into subfolders needed **zero path rewrites** (unlike the Python repo).
2. Compatibility barrels re-export all public names; private helpers stay private inside the package.
3. Client boundaries respected: `'use client'`, hook order, DOM/test selectors, default exports unchanged.
4. Proof before claiming done: byte/token differential harnesses (errorHandler 5/5, hotness 1016-token match, gameFetch byte identity) + full suite + tsc.

## Merge notes (orchestrator)
No conflicts: each agent owned a disjoint file. Transient tsc errors seen mid-flight were from in-progress sibling edits and cleared after completion. Authoritative final: `113 passed (113)` + exactly 6 known tsc errors; working tree clean after commits.
