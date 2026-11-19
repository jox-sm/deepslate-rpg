# PlayScreen compaction review

**File:** `components/game/PlayScreen.tsx` (360 → 66 lines) + new `components/game/play/` folder.
**Branch:** `refactor/compact-web`. Behavior-preserving; no feature/style rewrites.

## What moved where

| Destination | Contents (from original) |
|---|---|
| `play/constants.ts` | `POLL_INTERVAL_MS=2000`, `POLL_MAX_TRIES=60`, `TS_SKEW_SECONDS=2` (verbatim) |
| `play/types.ts` | `Message` interface (verbatim) |
| `play/usePlaySession.ts` (200 lines) | All session state (`messages/input/busy/error/sealed/turn`), refs (`turnRef`, `lastConsumedRef`, `lastSeenTsRef`, `sendEpochRef`, `seedRef`, `pollRef`), `autosave`, memory-restore `useEffect`, `pollForOutput`, `send` |
| `play/useSaveControls.ts` (91 lines) | `useRouter` + `savingFile`/`exitOpen` state, and `onSaveFile`/`onSave`/`onDiscard` (renamed `saveFile`/`saveAndExit`/`discard`) |
| `play/PlayHeader.tsx` (35) | `<header>`: scenario name, `Turn {n}`, Save / Saving… / Exit buttons |
| `play/StoryPanel.tsx` (53) | Message list, empty prompt, "The depths stir…" busy line, dismissable error button |
| `play/MoveInput.tsx` (36) | `<form>` + input + Send button |
| `play/ExitModal.tsx` (42) | Exit-confirm modal JSX (Save & Exit / Don't Save / Keep Playing) |

`PlayScreen.tsx` keeps the default export, `PlayScreenProps`, `'use client'`, and the root
`<div>` wrapper with the original child order (header → story → form → conditional modal).
It is now a thin orchestrator calling the two hooks and rendering the four subcomponents.

## Client-boundary / hook findings

- Every new `.tsx` and hook file starts with `"use client"` (event handlers + hooks).
  `constants.ts` / `types.ts` are pure TS (no directive needed).
- **Import paths:** all module imports use the `@/` alias (`paths: {"@/*": ["./*"]}`), so
  moving into `components/game/play/` required **no** relative-path rewrites — `@/` still
  resolves from the repo root. The only relative imports are the new sibling imports
  (`./constants`, `./types`, `./play/*`) inside the new files.
- `useRouter()` moved from `PlayScreen` into `useSaveControls`, but it is still called
  unconditionally during PlayScreen's render (via the hook), so hook ordering is stable
  across renders and the test's `next/navigation` mock still intercepts it.
- Shared mutable `turnRef` is passed by reference into `useSaveControls` typed structurally
  as `{ current: number }` — no copy, so autosave/turn semantics are unchanged.
- `setError` is passed down as `(value: string | null) => void`; React's `Dispatch<SetStateAction>`
  is assignable to it, so dismiss-on-click behavior is intact.
- The original `logRef` ref was written but never read; it was moved into `StoryPanel`
  anyway to keep the rendered DOM identical (zero behavior impact).

## Surprises

- The original had **no** auto-scroll effect despite the `logRef`; dropping it would have
  been safe, but it was preserved for strict DOM fidelity.
- All `classifyError` context labels (`PlayScreen.autosave/restore/poll/send/saveFile/discard`),
  the :8000 error suffixes, the canonical `{uuid, prompt, data, images, timestamp}` payload,
  seed-on-turn-1 logic, and the timestamp/skew turn-detection were carried over byte-for-byte.

## Tests run + result

- `npx tsc --noEmit` → **exactly 6 baseline errors** (2 in `hooks/useIdempotentRequest.test.ts`,
  4 in `lib/playClient.test.ts`), no new ones.
- `npx vitest run components/game/PlayScreen.test.tsx` → **4/4 passed** (same as baseline).
- Full suite not run by design (orchestrator runs it centrally).

## Risks

- No behavior risk found. The only non-mechanical tweaks were shortening comments and
  renaming the three save functions at the hook boundary (call sites in PlayScreen updated).
- `usePlaySession.ts` sits exactly at the 200-line soft limit; further additions should
  extract the polling block rather than grow this file.
- Other subagents were editing `lib/workers.ts`, `utilities/errorHandler.ts`,
  `utilities/gameFetchPipeline.ts`, `utilities/hotnessCache.ts` concurrently; I did not
  touch those. Their in-progress state did not add tsc errors at verification time.
