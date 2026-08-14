# Loop Engineering — Deepslate Dungeons (Web)

Every agent system is a while loop: **reason → act → observe → repeat until a stop condition**. The web app is the outer loop of the game (the player is the human terminator); everything below must be bounded, convergent, and observable. Companion doc: `D:\AI agent\plan\loops.md` (server side).

## 1. The loops in this app

| Loop | Where | Shape | Terminator | Verdict |
|------|-------|-------|------------|---------|
| **Play loop** (action → AI server → story) | game page (to be built) | conditional loop, human-gated | player exit (Save/Don't save popup) | 🟡 not built yet — guards specified in §4 |
| **Fetch pipeline** (game cards) | `utilities/gameFetchPipeline.ts` | batch queue + poll | verified gap (result key set) + 5s budget | ✅ sound |
| **Result poll** | `waitForFetchResult` | while-gap with adaptive backoff (10→100ms) | budget: 5s wall-clock | ✅ sound |
| **Retry wrapper** | `lib/retry.ts` | bounded N tries | count (default 3) | ✅ sound, minor gaps §3 |
| **Redis op retry** | `utilities/hotnessCacheWithRetry.ts` | bounded + exponential backoff | count (3) | ✅ sound |
| **Idempotent request** | `hooks/useIdempotentRequest.ts` | single retry on abort, same key | count (2 attempts) | 🟡 minor: same-key concurrency §3 |
| **SSE/stream** (planned) | game page | reconnect loop | budget: max reconnects + backoff | 🔴 must be bounded — §4 |

The healthy pattern everywhere: **verified gap as terminator, budget as backstop** — the fetch pipeline does exactly this. The play loop (when built) must too.

## 2. The atom: reason → act → observe

- The player's action → `POST` to AI server → story output back = one iteration of the play loop.
- The play page polls (or SSEs) the server between iterations; that poll is a loop that needs its own budget.

## 3. Findings (from audit)

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| W1 | `lib/retry.ts` retries **everything** greedily (4xx + 5xx alike) with no jitter | 🟡 | Add optional `isRetryable(err)` predicate + ±10% jitter to avoid thundering herd on shared failures |
| W2 | `useIdempotentRequest` — calling `sendRequest` twice with the **same key** creates two concurrent fetches (map entry overwritten, both `finally` blocks delete it) | 🟡 | Return the in-flight promise if the key is already in the map |
| W3 | `gameFetchPipeline` — `rpop` count assumes no writers between `lrange` and cleanup; extra rpops are harmless but noisy | 🟢 | Use `ltrim` after rpop or accept as-is |
| W4 | Play loop has no SSE reconnect budget / no poll timeout if built naively | 🔴 | §4 guards are mandatory for the play page |
| W5 | `waitForFetchResult` deletes the result key on read — two concurrent waiters on same requestId race | 🟢 | Keep TTL-orphan cleanup as-is (1h) — accepted |

## 4. Play-loop guards (apply when the game page is wired)

1. **Polling / SSE must be bounded**: max reconnect attempts (e.g. 5), exponential backoff (500ms → 8s cap), and a total staleness budget (e.g. 90s) after which the loop fails loudly ("the story grows quiet — reconnect").
2. **Autosave loop**: fires when the drained flag is set (server drain counter ≥ 10). It is a bounded one-shot export, not a timer — never `setInterval` autosave without a max iterations guard.
3. **Scenario iteration guard**: entry resolution (resume live → restore → create) must be a single pass — no retry loop around "restore failed" (bounded retry: 2 attempts, then fall back to fresh namespace with a notice).
4. **Idempotency**: every action POST carries an idempotency key (existing `useIdempotentRequest`) so the at-most-once server queue never double-processes.
5. **Exit is the human terminator**: the Save/Don't-save popup is the only unbounded loop — by design.
6. **localStorage budget**: `rpg:memory:{id}` blobs grow with sessions; cap registry at 20 scenarios and enforce 5MB quota checks before write (evict oldest `last_played_at` if over).

## 5. Debugging

- Log every loop iteration with `[Loop] {name} attempt {n}/{max}` — a flat UI log can't show loop bugs.
- For the play loop: assert state transitions (idle → playing → exiting) and never silently re-enter `playing` from `exiting`.
- Trace fetch pipeline: poll attempts and backoff values are already logged in `waitForFetchResult` shape — add attempt counters.