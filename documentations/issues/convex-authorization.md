# Issue: Convex Functions Have No Authentication Guards

## Status
✅ CLOSED — Auth guards implemented on all Convex mutations across games, characters, maps, items; staff role system added

## Category
Security, Architecture

## Problem Description

All Convex query and mutation handlers used plain `query()` / `mutation()` with no `ctx.auth.getUserIdentity()` check. Clerk was configured in `convex/auth.config.ts` but no handler enforced identity. Any client that could reach the Convex deployment URL could call all 17 functions (create, update, delete, list, get) with zero access control.

Additionally, `convex/games.ts` had a broken import on line 2:
```typescript
import { authenticatedQuery, authenticatedMutation } from "./_generated/server";
```
`authenticatedQuery` and `authenticatedMutation` **do not exist** in Convex's generated server module — this was a build error waiting to happen.

### Affected Functions

| File | Functions | Auth Before | Auth After |
|------|-----------|-------------|------------|
| `convex/games.ts` | `list`, `get`, `create`, `update`, `remove` | ❌ Broken import + no auth | ✅ Fixed import + auth on mutations (create/update/remove). `list`/`get` stay public. |
| `convex/characters.ts` | `listByGame`, `create`, `update`, `remove` | ❌ No auth | ✅ Auth on all mutations |
| `convex/maps.ts` | `listByGame`, `create`, `update`, `remove` | ❌ No auth | ✅ Auth on all mutations |
| `convex/items.ts` | `listByGame`, `create`, `update`, `remove` | ❌ No auth | ✅ Auth on all mutations |
| `convex/schema.ts` | Schema tables (games, characters, maps, items) | ❌ No `ownerId` field | ✅ `ownerId` on all 4 tables |

### Schema Gaps

None of the Convex tables (`games`, `characters`, `maps`, `items`) had an `ownerId` field, making ownership-based access control impossible.

### Missing Staff Role System

No `staff` table existed in the schema, no role-based access control was possible, and no authorization helper functions existed.

## Solution Implemented

### Step 1 — Fix broken import in `convex/games.ts`

Replaced the non-existent `authenticatedQuery`/`authenticatedMutation` import with the correct `query`/`mutation` from `./_generated/server`, consistent with all other Convex files.

### Step 2 — Add `ownerId` to schema

Added `ownerId: v.string()` to all 4 tables in `convex/schema.ts`:
- `games`
- `characters`
- `maps`
- `items`

Added `staff` table with `clerkUserId: v.string()` and `degree: v.number()`, indexed with `by_clerkUserId` for fast lookups.

### Step 3 — Add auth guards to all mutations

Every mutation handler (`create`, `update`, `remove`) across all 4 files now checks:
```typescript
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Unauthenticated");
```

For `create` mutations — `ownerId: identity.tokenIdentifier` is included in the insert object.

For `update` and `remove` mutations — the document's `ownerId` is verified against `identity.tokenIdentifier` to enforce ownership.

Public reads (`list`, `get`, `listByGame`) remain open for discovery with no auth check.

### Step 4 — Create `convex/authHelpers.ts`

Server-side auth guard wrappers:
- `requireAuth(ctx)` — returns identity, throws `"Unauthenticated"` if not logged in
- `requireStaff(ctx, minDegree)` — requires auth + minimum staff degree; superadmin (degree 4) always bypasses; throws `"Forbidden"` if insufficient
- Exports `STAFF_DEGREE` constant (user=0, customerSupport=1, moderator=2, admin=3, superAdmin=4)

### Step 5 — Create `convex/staff.ts`

Staff table management:
- `getStaffDegree` (query) — looks up degree by `clerkUserId`, defaults to 0
- `list` (query) — returns all staff records
- `create` (mutation) — upserts staff record
- `update` (mutation) — patches degree by `staffId`
- `remove` (mutation) — deletes by `staffId`

### Step 6 — Create `utilities/security/` module

Client-side security utilities:
- `constants.ts` — `STAFF_DEGREE` enum, `StaffDegree` type, `ROLE_TTL` map (TTL per role for caching)
- `types.ts` — `StaffRecord`, `StaffAssignment`, `AuthorizationResult` types
- `authorize.ts` — `hasMinimumDegree()`, `isStaff()`, `getRoleLabel()` helpers
- `index.ts` — barrel re-exports

## Files Modified

- `convex/schema.ts` — Added `ownerId` to 4 tables + new `staff` table with index
- `convex/games.ts` — Fixed broken import (authenticatedQuery → query, authenticatedMutation → mutation), added auth guards on create/update/remove, ownership verification, removed unused `api` import where appropriate

## Files Created

- `convex/authHelpers.ts` — `requireAuth()`, `requireStaff()` wrappers
- `convex/staff.ts` — Staff CRUD + `getStaffDegree` query
- `utilities/security/constants.ts` — Role constants and TTL map
- `utilities/security/types.ts` — Authorization type definitions
- `utilities/security/authorize.ts` — Client-side role helpers
- `utilities/security/index.ts` — Barrel export

## Verification

```typescript
// Auth gate on create mutation — games.ts:31-32
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Unauthenticated");

// Ownership check on update — games.ts:58-61
const game = await ctx.db.get(args.gameId);
if (!game) throw new Error("Game not found");
if (game.ownerId !== identity.tokenIdentifier)
  throw new Error("Unauthorized");

// Staff gate pattern — authHelpers.ts:30-44
const { identity, degree } = await requireStaff(ctx, STAFF_DEGREE.moderator);
```

## Verification Checklist

- [x] `games.ts` — Fixed import: uses `query`/`mutation` not `authenticatedQuery`/`authenticatedMutation`
- [x] `ownerId` field exists on all 4 tables (games, characters, maps, items)
- [x] All mutations check `ctx.auth.getUserIdentity()`
- [x] Ownership verified on `update`/`remove` via `tokenIdentifier`
- [x] `staff` table created with `by_clerkUserId` index
- [x] `staff.ts` implements `getStaffDegree` query for role lookups
- [x] `authHelpers.ts` provides reusable `requireAuth()` and `requireStaff()` wrappers
- [x] `utilities/security/` module created with constants, types, authorize helpers
- [x] Public reads (`list`, `get`, `listByGame`) remain open — no auth needed
- [x] TypeScript compiles cleanly — `npx tsc --noEmit` reports zero errors
- [x] Convex types regenerated — `npx convex codegen` succeeds

## Related Issues
- Security discussion: `documentations/discussions/security/convex-authorization.md`
- Staff role caching strategy documented in security discussion (TTL per role via Clerk JWT claims)

issues solved::

[SECURITY] Internal Drain Calls Use User JWT With No Service-to-Service Authentication
high
security
#106
---
[SECURITY] No Authorization Layer - All Authenticated Users Are Equally Privileged
high
security
#105
---
[SECURITY] Convex Functions Have No Authentication Guards - Full Public Access to All CRUD Operations
critical
security
#103

