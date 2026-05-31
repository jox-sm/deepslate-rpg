# Issue #73: useAuth import name conflict with Clerk

## Status
✅ CLOSED

## Category
Bug

## Problem Description
`hooks/useAuth.ts` imported `{ useAuth }` from `@clerk/nextjs` but also defined a local `export function useAuth()`. The name collision caused TypeScript build failure — the local function declaration conflicted with the imported binding.

## Root Cause
The hook file named itself `useAuth` and also imported `useAuth` from Clerk — same name, same scope, collision.

## Solution Implemented
Renamed Clerk import to avoid the collision:
```typescript
import { useAuth as useClerkAuth } from '@clerk/nextjs';
```

The local `useAuth` function remained unchanged, and all internal usage switched from `useAuth()` to `useClerkAuth()`.

## Files Modified
- `hooks/useAuth.ts` (import statement + all internal references)

## Verification Checklist
- [x] Build passes (`npm run build`)
- [x] No naming conflicts remaining
- [x] Clerk's `getToken`, `isLoaded`, `isSignedIn` still destructured correctly
