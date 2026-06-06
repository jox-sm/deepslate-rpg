# Issue #71: ZodError uses .issues not .errors - build failure in push route

## Status
✅ CLOSED

## Category
Bug

## Problem Description
Three places in `app/api/push/route.ts` accessed `validationResult.error.errors` which doesn't exist on `ZodError`. Zod uses `.issues`, not `.errors`. Caused TypeScript build failure.
- Line 40: `validationResult.error.errors` in `pushRequestSchema` validation
- Line 64: `gameValidation.error.errors` in game data validation
- Line 95: `likeValidation.error.errors` in like data validation

## Root Cause
Confusion between Zod's API property name `.issues` and a common mental model of `.errors`. Zod's `ZodError` type uses `.issues: ZodIssue[]`.

## Solution Implemented
Replaced all three `.errors` with `.issues`:
- `validationResult.error.errors` → `validationResult.error.issues`
- `gameValidation.error.errors` → `gameValidation.error.issues`
- `likeValidation.error.errors` → `likeValidation.error.issues`

## Files Modified
- `app/api/push/route.ts` (3 occurrences)

## Verification Checklist
- [x] Build passes (`npm run build`)
- [x] Error response still includes validation details
- [x] Zod types correctly resolved


## Depends On
— (none)

## Blocks
- [#77](77-ZOD-VALIDATION-CENTRALIZATION.md)
