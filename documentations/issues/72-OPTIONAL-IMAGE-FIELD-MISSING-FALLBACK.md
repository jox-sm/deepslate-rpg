# Issue #72: Optional image field missing string fallback - type error

## Status
✅ CLOSED

## Category
Bug

## Problem Description
`gameValidation.data.image` was typed as `string | undefined` (optional field in Zod schema) but `GameCardProps.image` expects `string` (non-optional). Caused TypeScript build failure when assigning to `image: gameValidation.data.image`.

## Root Cause
The Zod schema for game data in `app/api/push/route.ts` marked `image` as `z.string().url().optional()`, making the type `string | undefined`. But `GameCardProps.image` (in `types/cards.ts`) is defined as `image: string` with no optional marker.

## Solution Implemented
Added `|| ''` fallback: `image: gameValidation.data.image || ''`

This matches the existing pattern on line 73: `likes_count: gameValidation.data.likes_count || 0`

## Files Modified
- `app/api/push/route.ts` (line 74)

## Verification Checklist
- [x] Build passes (`npm run build`)
- [x] Type assignment resolves correctly
- [x] Matches existing fallback pattern in same file
