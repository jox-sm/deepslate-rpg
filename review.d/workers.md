# workers — lib/workers.ts split (commit pending)

## What moved
`lib/workers.ts` (273 lines) → `lib/workers/` package:
- `config.ts` (41): cadence config, jitter/stagger constants, `WorkerName`
- `state.ts` (60): global singleton store (on `globalThis`), state helpers, logging
- `ticks.ts` (57): the 5 work-check tick functions + `TICKS` registry
- `runner.ts` (123): scheduling, backoff, lifecycle, exported API
- `lib/workers.ts` is now a 3-line barrel re-exporting the 4 original public names.

## Dependency findings
- Imports all used `@/` aliases, so nesting into a subfolder required NO path rewrites —
  unlike the other files in this repo.
- No cycles: `config ← state/ticks ← runner`; `schedule` ↔ `runTick` both live in runner.
- **Critical invariant:** the state store is a single object on `globalThis`
  (`__deepslate_workers__`) to survive HMR without orphan timers — it stays in one
  module (`state.ts`) imported by everyone, so identity is preserved.

## Surprises / risks
- Moving code across module boundaries required adding `export` to previously private
  types/constants (`WorkerName`, `WORKER_IDLE_CEIL`, `TICKS`, `WorkerState`, etc.) —
  tsc caught all of them (TS2459/TS7053); after exports, only the 6 known baseline
  errors remain.
- Parallel agent editing `utilities/gameFetchPipeline.ts` is imported here via the
  `@/` barrel, so no coordination was needed.

## Tests
`npx tsc --noEmit` → exactly 6 known baseline errors, zero new ones. Full suite pending.
