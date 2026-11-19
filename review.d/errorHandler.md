# errorHandler.ts compaction review

Target: `utilities/errorHandler.ts` — behavior-preserving split into `utilities/error/*`.
Branch: `refactor/compact-web`.

## What moved where

Original HEAD file was **494 lines** (`git show HEAD:utilities/errorHandler.ts`). It is now a
16-line compatibility barrel; implementation lives in a new `utilities/error/` package:

| Module | Lines | Contents (verbatim from HEAD unless noted) |
|---|---|---|
| `utilities/errorHandler.ts` (barrel) | 16 | Re-exports all 16 named exports from `./error/*`. No default export existed originally. |
| `utilities/error/classifyStatus.ts` | 109 | `classifyStatusError(err, status)` — the HTTP-status `switch` (all cases + `default`), moved verbatim. |
| `utilities/error/classify.ts` | 119 | `classifyError` — TypeError/DOMException/Error-message branches + fallback, verbatim. |
| `utilities/error/toast.ts` | 27 | `toastConfigMap`, `showToastFor`. |
| `utilities/error/mapToComponent.ts` | 87 | `mapToComponent` (imports the 6 error-page components). |
| `utilities/error/wrappers.ts` | 111 | `tryOrError`, `tryOrErrorSync`, `handleApiResponse`, `tryFetch`. |
| `utilities/error/helpers.ts` | 52 | `classifyAndFormat`, `createApiErrorHandler`, `isNotFound`, `isServerError`, `isAuthError`, `isNetworkError`, `isRetryable`, `getErrorMessage`, private `formatZodError`. |

All modules ≤ 111 lines (budget ~200); barrel 16 lines (budget 30).

**Only structural change (not a rewrite):** the 103-line `switch (status)` block inside
`classifyError` was lifted verbatim into `classifyStatusError(err, status)`; the original
`if (status-object)` branch now does `return classifyStatusError(err, status)`. The switch's
`default` returns in every path, so the extracted function always returns a `ClassifiedError`,
exactly as the inline switch did. `err` is passed through so `originalError` keeps identity.
This was required to keep `classify.ts` under the ~200-line budget (the original single
function was ~231 lines). Differential-tested — see Tests.

## Import / boundary findings

- All original imports used the `@/` path alias (`@/types/errorHandler`,
  `@/exceptions/errorPages`, `@/ui/notifications`), which maps to the repo root in
  `tsconfig.json`. **No `./x` → `../x` rewrite was needed** in the new subfolder; the alias
  imports resolve identically from `utilities/error/`.
- New cross-module imports inside the package use `./` (siblings) — correct relative depth.
- The barrel lives at the original path `utilities/errorHandler.ts`, so every caller
  (`@/utilities/errorHandler` in ~40 files, plus the test's `./errorHandler`) is unchanged.
- **No `'use client'` / server-only directive existed in the original file** — none was added
  or removed. The module still imports React error pages and the default `window` callbacks
  in `mapToComponent` are unchanged (still deferred to call time). Module system unchanged
  (ESM, `moduleResolution: bundler`).
- Caller survey: `classifyError` is by far the most used; `tryOrErrorSync`, `tryOrError`,
  `tryFetch`, `handleApiResponse`, `toastConfigMap`, `mapToComponent`, predicates etc. also
  appear. The barrel re-exports **all 16** named exports, so no caller needs editing.

## Surprises

1. The task/skill quoted **494 lines**; the first working-tree read displayed 533. The
   authoritative `git show HEAD:utilities/errorHandler.ts` (the mandated source) is 494 lines,
   so 494 was correct. All code was copied from `git show HEAD`, not from the working copy.
2. `types/errorHandler.ts` exports an `ApiErrorHandler` interface that `createApiErrorHandler`
   does **not** use (the original returns an inferred object). Left as-is — adding an explicit
   annotation would change the inferred type, so it was not touched.
3. PowerShell's pipeline transcodes UTF-8: `git show | Set-Content -Encoding UTF8` mangled the
   em-dash in the 503 message (`—` → `ΓÇö`). My written module has the correct em-dash (matching
   the original read). The differential oracle had to be generated with raw `cmd` redirection
   to avoid a false failure. Flagging so the orchestrator does not "fix" the em-dash.

## Tests run + result

- `npx tsc --noEmit` — **exactly the 6 known baseline errors** in
  `hooks/useIdempotentRequest.test.ts` (2) and `lib/playClient.test.ts` (4). No new errors.
- `npx vitest run utilities/errorHandler.test.ts` — **6/6 passed** (baseline).
- Extra differential harness (temporary, removed afterward): imported the exact HEAD source
  (raw bytes) and the new barrel, compared **all 16 exports**, `toastConfigMap`, and
  `classifyError` over 16 HTTP statuses (plain object + `Response`), 29 error-message variants
  (`Error` + `TypeError`), `TypeError("Failed to fetch")`, `DOMException("AbortError")`,
  opaque values, and 2 context values, plus `classifyAndFormat` (zod path), wrappers and
  predicates — **5/5 checks passed, byte-for-byte behavior identical**.

## Risks

- Low. The single non-mechanical edit is the status-switch extraction, fully covered by the
  differential harness. Everything else is a verbatim move.
- No git add/commit performed (orchestrator handles that). Only the target, `utilities/error/*`,
  and this review file were touched; temporary harness files were deleted.
