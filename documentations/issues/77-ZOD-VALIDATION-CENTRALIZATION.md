# Issue #77: Centralized Zod validation — security and consistency

## Status
✅ CLOSED

## Category
Security / Refactor

## Problem Description
Zod schemas were defined inline inside the push route handler, leading to:
1. **No shared validation layer** — each route that needs validation must redefine schemas
2. **Inconsistent validation rules** — the same data shape could be validated differently across routes
3. **No inferred TypeScript types from validation** — types were manually maintained in separate files (`types/cards.ts`, `types/db.ts`)
4. **No type safety for API contracts** — request/response shapes lacked a single source of truth

## Solution Implemented

### 1. Created `types/validation.ts` — centralized Zod schema definitions

All data shapes that cross the API boundary are now defined as Zod schemas with inferred TypeScript types:

- **Card/API types**: `gameCardPropsSchema`, `gameApiResponseSchema`, `gameApiErrorSchema`, `likeDeltaSchema`, `likeApiResponseSchema`
- **DB types**: `likesSchema`, `gameFormDbSchema`, `uploadProgressSchema`
- **Image types**: `imageUploadResultSchema`, `imageConversionResultSchema`, `imageUploadApiResponseSchema`
- **Push route types**: `pushRequestSchema`, `pushGameDataSchema`

Each schema exports a matching `z.infer<>` type so TypeScript types stay in sync with validation rules.

### 2. Refactored `/app/api/push/route.ts` to use shared schemas

Removed all inline Zod definitions (`pushRequestSchema`, `gameSchema`, `likeSchema`) and replaced with imports from `types/validation.ts`.

```typescript
// Before
import { z } from 'zod';
const pushRequestSchema = z.object({ ... });
const gameSchema = z.object({ ... });

// After
import { pushRequestSchema, pushGameDataSchema, likesSchema } from '@/types/validation';
```

### 3. Security benefits

| Risk | Before | After |
|------|--------|-------|
| Schema drift | Inline schemas could get out of sync with TS types | Zod schemas are the single source of truth; TS types are `z.infer<>` |
| Inconsistent validation | Each route defines its own rules | Shared schemas guarantee identical validation everywhere |
| Missing input validation | No systematic enforcement | Any new API route can import and reuse existing schemas |
| Hard to audit | Validation scattered across files | All schemas in one file for easy security review |

## Files Modified
- `types/validation.ts` (new — all Zod schemas + inferred types)
- `app/api/push/route.ts` (refactored to use shared schemas, removed inline Zod)

## Verification Checklist
- [x] Build passes (`npm run build`)
- [x] Push route validates request body with `pushRequestSchema`
- [x] Push route validates game data with `pushGameDataSchema`
- [x] Push route validates like data with `likesSchema`
- [x] All inline Zod imports removed from push route
- [x] TypeScript types derived from Zod schemas via `z.infer`

## Related Issues
- #71: ZodError uses .issues not .errors (build fix)
- #64: Unnecessary Zod schema for simple query params (removed inline Zod from games route)
