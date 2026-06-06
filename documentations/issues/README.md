# GitHub Issues Documentation Index

## Overview

Complete documentation of all GitHub issues for the Deepslate RPG project. Each issue includes:
- Problem description and root cause
- Solution implemented with code examples
- Testing strategies and verification checklists
- Dependencies on other issues

**Last updated:** 2026-06-07  
**Total issues:** 45 unique (42 closed, 3 open)

---

## Dependency Graph

```
#66 ─┐
#65 ─┤ Security Layer
#77 ─┘  (#77 depends on #71, #64)

#90 ─── #89 ─── #95          Likes Pipeline
  │       │
  ├── #91 ┘                    State Sync
  │
  ├── #92                      Dead Code
  │
  └── #93 ─── #94             Redis Migration

#56 ─── #70 ─── #69           Image Pipeline
                #74
                #76

#57 ─── #58 ─── #54 ─── #75  Form Layer

#67 ─── #78 ─── #62           Backend Reliability
  │       │
  └── #82 ─── #81 ─── #80     GamePage Suite
              │
              └── #84 ─── #85

#48 ─── #50 ─── #51           Design System
#49 ─── #52                    Architecture
#53 ─── #54                    Accessibility

#71 ─── #72 ─── #73           Build Fixes
```

---

## Dependency Chains

### Chain 1: Likes Pipeline
Centralized Redis → Instant write → Optimistic UI

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 90 | [Centralize Redis queue utilities](./90-CENTRALIZED-REDIS-QUEUES.md) | ✅ | — | #89, #91, #92, #93 |
| 89 | [Likes instant write + async drain](./89-LIKES-SYSTEM-INSTANT-WRITE.md) | ✅ | #90 | #95 |
| 91 | [State sync with JSON Patch](./91-STATE-SYNC-JSON-PATCH.md) | ✅ | #90 | — |
| 92 | [Remove dead 'load' key](./92-REMOVE-DEAD-LOAD-KEY.md) | ✅ | #90 | — |
| 95 | [Zustand Likes Store](./95-ZUSTAND-LIKES-STORE.md) | 🔄 | #89, #90 | — |

### Chain 2: Redis Migration
Cloud → Upstash → Remove ioredis

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 93 | [Migrate to Upstash Redis](./93-MIGRATE-TO-UPSTASH-REDIS.md) | ✅ | #90 | #94 |
| 94 | [Remove ioredis dependency](./94-REMOVE-IORedis.md) | 🔄 | #93 | — |

### Chain 3: Image Pipeline
Memory leak → Data URL fix → File handling → No-images crash

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 56 | [Object URL memory leak](./56-OBJECT-URL-MEMORY-LEAK.md) | ✅ | — | #70 |
| 70 | [Data URL fetch round-trip](./70-WASTEFUL-DATA-URL-FETCH-ROUND-TRIP-IN-IMAGE-PIPELINE.md) | ✅ | #56 | #69, #74 |
| 69 | [File object lost in JSON.stringify](./69-FILE-OBJECT-SILENTLY-LOST-IN-JSON-STRINGIFY.md) | ✅ | #70 | — |
| 74 | [Request aborted no images](./74-REQUEST-ABORTED-NO-IMAGES.md) | ✅ | #70 | #76 |
| 76 | [Documentation and bugfixes](./76-DOCUMENTATION-AND-BUGFIXES.md) | ✅ | #74 | — |

### Chain 4: Form Layer
Prop drilling → Form hooks → A11y → Styling

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 57 | [Excessive prop drilling](./57-EXCESSIVE-PROP-DRILLING.md) | ✅ | — | #58 |
| 58 | [Form hooks code duplication](./58-FORM-HOOKS-CODE-DUPLICATION.md) | ✅ | #57 | #54 |
| 54 | [Form accessibility deficiencies](./54-FORM-ACCESSIBILITY-DEFICIENCIES.md) | ✅ | #58 | #75 |
| 75 | [Form styles button/preview/wizard](./75-FORM-STYLES-BUTTON-PREVIEW-WIZARD.md) | ✅ | #54 | — |

### Chain 5: Backend Reliability
N+1 Redis → DB retry → Cache helpers → Batch fetch

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 67 | [N+1 Redis query](./67-N+1-REDIS-QUERY-IN-GAMES-API.md) | ✅ | — | #78 |
| 78 | [DB retry mechanism](./78-DB-RETRY-MECHANISM.md) | ✅ | #67 | #82 |
| 62 | [Route-specific cache helpers](./62-ROUTE-SPECIFIC-HELPERS-IN-CACHE-WARMUP-MODULE.md) | ✅ | — | #78 |
| 87 | [Duplicate of #78](./87-DUPLICATE-DB-RETRY-MECHANISM.md) | ✅ | — | — |

### Chain 6: GamePage Suite
Card click → Hotness cache → Batch fetch → UI components → A11y

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 80 | [Card click navigation](./80-GAMEPAGE-CARD-CLICK-NAVIGATION.md) | ✅ | — | #81, #82, #84 |
| 81 | [Binary-search hotness cache](./81-GAMEPAGE-BINARY-SEARCH-HOTNESS-CACHE.md) | 🔄 | #80 | #82 |
| 82 | [Batch MongoDB fetch](./82-GAMEPAGE-BATCH-MONGODB-FETCH.md) | 🔄 | #80, #81 | #84 |
| 84 | [FullGameResponse type + UI](./84-GAMEPAGE-FULLGAMERESPONSE-TYPE-UI.md) | ✅ | #80, #82 | #85 |
| 85 | [Responsive + accessibility](./85-GAMEPAGE-RESPONSIVE-ACCESSIBILITY.md) | ✅ | #84 | — |
| 83 | [Duplicate of #84](./83-GAMEPAGE-FULLGAMERESPONSE-TYPE-UI.md) | ✅ | — | — |

### Chain 7: Design System
Layout → Design tokens → Responsiveness

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 48 | [Inconsistent layout system](./48-INCONSISTENT-LAYOUT-SYSTEM.md) | ✅ | — | #50 |
| 50 | [Missing design system](./50-MISSING-DESIGN-SYSTEM.md) | ✅ | #48 | #51 |
| 51 | [Responsiveness gaps](./51-RESPONSIVENESS-IMPLEMENTATION-GAPS.md) | ✅ | #50 | — |
| 49 | [Rendering strategy inefficiencies](./49-RENDERING-STRATEGY-INEFFICIENCIES.md) | ✅ | — | #52 |
| 52 | [Component coupling](./52-COMPONENT-COUPLING-REUSABILITY.md) | ✅ | #49 | — |

### Chain 8: Accessibility
General → Form-specific

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 53 | [Accessibility gaps](./53-ACCESSIBILITY-GAPS.md) | ✅ | — | — |
| 54 | [Form accessibility](./54-FORM-ACCESSIBILITY-DEFICIENCIES.md) | ✅ | #58 | — |

### Chain 9: Security & Validation
JWT auth → Rate limiter → Zod centralization

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 66 | [Wrong JWT auth approach](./66-WRONG-JWT-AUTH-APPROACH.md) | ✅ | — | #65 |
| 65 | [Rate limiter wrong API](./65-RATE-LIMITER-USES-WRONG-BOTTLENECK-API.md) | ✅ | #66 | — |
| 71 | [ZodError .issues not .errors](./71-ZODERROR-USES-ISSUES-NOT-ERRORS.md) | ✅ | — | #77 |
| 64 | [Unnecessary Zod schema](./64-UNNECESSARY-ZOD-SCHEMA-FOR-SIMPLE-QUERY-PARAMS.md) | ✅ | — | #77 |
| 77 | [Centralized Zod validation](./77-ZOD-VALIDATION-CENTRALIZATION.md) | ✅ | #71, #64 | — |

### Chain 10: Build Fixes
Standalone type/import errors

| # | Issue | Status | Depends On | Blocks |
|---|-------|--------|------------|--------|
| 71 | [ZodError uses .issues not .errors](./71-ZODERROR-USES-ISSUES-NOT-ERRORS.md) | ✅ | — | #77 |
| 72 | [Optional image missing fallback](./72-OPTIONAL-IMAGE-FIELD-MISSING-FALLBACK.md) | ✅ | — | — |
| 73 | [useAuth import conflict](./73-USEAUTH-IMPORT-NAME-CONFLICT.md) | ✅ | — | — |

### Chain 11: Standalone Fixes
No dependencies

| # | Issue | Status | Category |
|---|-------|--------|----------|
| 59 | [Array index as React key](./59-ARRAY-INDEX-AS-REACT-KEY.md) | ✅ | Bug |
| 60 | [Duplicate sleep utility](./60-DUPLICATE-SLEEP-UTILITY.md) | ✅ | Refactor |
| 61 | [Likes count reset to 0](./61-LIKES-COUNT-RESET-TO-ZERO.md) | ✅ | Bug |
| 68 | [Double-read request body](./68-DOUBLE-READ-REQUEST-BODY-IN-API-CONVERTURL.md) | ✅ | Bug |
| 55 | [Inadequate state management](./55-INADEQUATE-STATE-MANAGEMENT.md) | ✅ | Refactor |
| 88 | [Centralized errors](./88-GAMES-CENTRALIZED-ERRORS.md) | ✅ | Maintenance |
| 86 | [Branch cleanup](./86-GAMES-BRANCH-CLEANUP.md) | ✅ | Maintenance |

---

## All Issues

### GamePage Feature Suite

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 80 | [Card click navigation](./80-GAMEPAGE-CARD-CLICK-NAVIGATION.md) | ✅ | UI/UX | — |
| 81 | [Binary-search hotness cache](./81-GAMEPAGE-BINARY-SEARCH-HOTNESS-CACHE.md) | 🔄 | Performance | #80 |
| 82 | [Batch MongoDB fetch](./82-GAMEPAGE-BATCH-MONGODB-FETCH.md) | 🔄 | Performance | #80, #81 |
| 84 | [FullGameResponse type + UI](./84-GAMEPAGE-FULLGAMERESPONSE-TYPE-UI.md) | ✅ | Feature | #80, #82 |
| 85 | [Responsive + accessibility](./85-GAMEPAGE-RESPONSIVE-ACCESSIBILITY.md) | ✅ | UX/A11y | #84 |

### Likes & State Infrastructure

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 89 | [Likes instant write + async drain](./89-LIKES-SYSTEM-INSTANT-WRITE.md) | ✅ | Feature | #90 |
| 90 | [Centralize Redis queue utilities](./90-CENTRALIZED-REDIS-QUEUES.md) | ✅ | Refactor | — |
| 91 | [State sync with JSON Patch](./91-STATE-SYNC-JSON-PATCH.md) | ✅ | Feature | #90 |
| 92 | [Remove dead 'load' key](./92-REMOVE-DEAD-LOAD-KEY.md) | ✅ | Refactor | #90 |
| 93 | [Migrate to Upstash Redis](./93-MIGRATE-TO-UPSTASH-REDIS.md) | ✅ | Infrastructure | #90 |
| 94 | [Remove ioredis dependency](./94-REMOVE-IORedis.md) | 🔄 | Cleanup | #93 |
| 95 | [Zustand Likes Store](./95-ZUSTAND-LIKES-STORE.md) | 🔄 | Feature | #89 |

### Backend / Reliability

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 62 | [Route-specific cache helpers](./62-ROUTE-SPECIFIC-HELPERS-IN-CACHE-WARMUP-MODULE.md) | ✅ | Code quality | — |
| 65 | [Rate limiter wrong API](./65-RATE-LIMITER-USES-WRONG-BOTTLENECK-API.md) | ✅ | Functionality | #66 |
| 66 | [Wrong JWT auth approach](./66-WRONG-JWT-AUTH-APPROACH.md) | ✅ | Security | — |
| 67 | [N+1 Redis query](./67-N+1-REDIS-QUERY-IN-GAMES-API.md) | ✅ | Performance | — |
| 68 | [Double-read request body](./68-DOUBLE-READ-REQUEST-BODY-IN-API-CONVERTURL.md) | ✅ | Runtime error | — |
| 77 | [Centralized Zod validation](./77-ZOD-VALIDATION-CENTRALIZATION.md) | ✅ | Security | #71, #64 |
| 78 | [DB retry mechanism](./78-DB-RETRY-MECHANISM.md) | ✅ | Reliability | #67 |
| 88 | [Centralized errors](./88-GAMES-CENTRALIZED-ERRORS.md) | ✅ | Maintenance | — |

### Image Pipeline

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 56 | [Object URL memory leak](./56-OBJECT-URL-MEMORY-LEAK.md) | ✅ | Memory leak | — |
| 69 | [File object lost in JSON.stringify](./69-FILE-OBJECT-SILENTLY-LOST-IN-JSON-STRINGIFY.md) | ✅ | Data loss | #70 |
| 70 | [Data URL fetch round-trip](./70-WASTEFUL-DATA-URL-FETCH-ROUND-TRIP-IN-IMAGE-PIPELINE.md) | ✅ | Performance | #56 |
| 74 | [Request aborted no images](./74-REQUEST-ABORTED-NO-IMAGES.md) | ✅ | Runtime | #70 |
| 76 | [Documentation and bugfixes](./76-DOCUMENTATION-AND-BUGFIXES.md) | ✅ | Build | #74 |

### Frontend / React

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 55 | [Inadequate state management](./55-INADEQUATE-STATE-MANAGEMENT.md) | ✅ | Scalability | — |
| 57 | [Excessive prop drilling](./57-EXCESSIVE-PROP-DRILLING.md) | ✅ | Performance | — |
| 58 | [Form hooks duplication](./58-FORM-HOOKS-CODE-DUPLICATION.md) | ✅ | Maintenance | #57 |
| 59 | [Array index as React key](./59-ARRAY-INDEX-AS-REACT-KEY.md) | ✅ | Reconciliation bugs | — |
| 60 | [Duplicate sleep utility](./60-DUPLICATE-SLEEP-UTILITY.md) | ✅ | Maintenance | — |
| 61 | [Likes count reset to 0](./61-LIKES-COUNT-RESET-TO-ZERO.md) | ✅ | Data loss | — |

### Validation / Build Fixes

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 64 | [Unnecessary Zod schema](./64-UNNECESSARY-ZOD-SCHEMA-FOR-SIMPLE-QUERY-PARAMS.md) | ✅ | Maintenance | — |
| 71 | [ZodError uses .issues](./71-ZODERROR-USES-ISSUES-NOT-ERRORS.md) | ✅ | Build failure | — |
| 72 | [Optional image missing fallback](./72-OPTIONAL-IMAGE-FIELD-MISSING-FALLBACK.md) | ✅ | Build failure | — |
| 73 | [useAuth import conflict](./73-USEAUTH-IMPORT-NAME-CONFLICT.md) | ✅ | Build failure | — |

### UI / Accessibility

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 48 | [Inconsistent layout system](./48-INCONSISTENT-LAYOUT-SYSTEM.md) | ✅ | UX | — |
| 49 | [Rendering strategy inefficiencies](./49-RENDERING-STRATEGY-INEFFICIENCIES.md) | ✅ | Performance | — |
| 50 | [Missing design system](./50-MISSING-DESIGN-SYSTEM.md) | ✅ | Consistency | #48 |
| 51 | [Responsiveness gaps](./51-RESPONSIVENESS-IMPLEMENTATION-GAPS.md) | ✅ | UX | #50 |
| 52 | [Component coupling](./52-COMPONENT-COUPLING-REUSABILITY.md) | ✅ | Maintainability | #49 |
| 53 | [Accessibility gaps](./53-ACCESSIBILITY-GAPS.md) | ✅ | UX/A11y | — |
| 54 | [Form accessibility](./54-FORM-ACCESSIBILITY-DEFICIENCIES.md) | ✅ | UX/A11y | #58 |
| 75 | [Form styles](./75-FORM-STYLES-BUTTON-PREVIEW-WIZARD.md) | ✅ | UI | #54 |

### Maintenance

| # | Issue | Status | Impact | Depends On |
|---|-------|--------|--------|------------|
| 86 | [Branch cleanup](./86-GAMES-BRANCH-CLEANUP.md) | ✅ | Maintenance | — |
| 87 | [Duplicate of #78](./87-DUPLICATE-DB-RETRY-MECHANISM.md) | ✅ | Duplicate | — |

---

## Open Issues

| # | Issue | Status | Blocks |
|---|-------|--------|--------|
| 81 | [Binary-search hotness cache](./81-GAMEPAGE-BINARY-SEARCH-HOTNESS-CACHE.md) | 🔄 | #82 |
| 82 | [Batch MongoDB fetch](./82-GAMEPAGE-BATCH-MONGODB-FETCH.md) | 🔄 | #84 |
| 94 | [Remove ioredis dependency](./94-REMOVE-IORedis.md) | 🔄 | — |
| 95 | [Zustand Likes Store](./95-ZUSTAND-LIKES-STORE.md) | 🔄 | — |

---

## Implementation Phases

### Phase 1: Build Fixes (must pass first)
1. #71 — ZodError .issues vs .errors
2. #72 — Optional image fallback
3. #73 — useAuth import conflict

### Phase 2: Security & Validation
1. #66 — JWT auth approach
2. #65 — Rate limiter
3. #64 — Unnecessary Zod
4. #77 — Centralized Zod (depends on #71, #64)

### Phase 3: Backend Reliability
1. #67 — N+1 Redis query
2. #62 — Cache helpers
3. #78 — DB retry (depends on #67)

### Phase 4: Image Pipeline
1. #56 — Memory leak
2. #70 — Data URL round-trip (depends on #56)
3. #69 — File object loss (depends on #70)
4. #74 — No images crash (depends on #70)

### Phase 5: Frontend & Forms
1. #57 — Prop drilling
2. #58 — Form hooks (depends on #57)
3. #59 — React keys
4. #60 — Sleep utility
5. #55 — State management

### Phase 6: UI / Design System
1. #48 — Layout system
2. #50 — Design system (depends on #48)
3. #51 — Responsiveness (depends on #50)
4. #49 — Rendering strategy
5. #52 — Component coupling (depends on #49)
6. #53 — Accessibility
7. #54 — Form a11y (depends on #58)
8. #75 — Form styles (depends on #54)

### Phase 7: Likes Infrastructure
1. #90 — Centralize Redis queues
2. #89 — Likes instant write (depends on #90)
3. #92 — Remove dead load key (depends on #90)
4. #93 — Upstash migration (depends on #90)
5. #94 — Remove ioredis (depends on #93)
6. #91 — JSON Patch state sync (depends on #90)
7. #95 — Zustand likes store (depends on #89)

### Phase 8: GamePage
1. #80 — Card click navigation
2. #81 — Hotness cache (depends on #80)
3. #82 — Batch MongoDB (depends on #80, #81)
4. #84 — FullGameResponse (depends on #80, #82)
5. #85 — Responsive + a11y (depends on #84)

---

## Quick Reference

### By Severity

**Build Blockers:**
- #71, #72, #73 — Type/import errors preventing build

**Security:**
- #66 — Wrong JWT auth approach
- #77 — Centralized Zod validation

**Data Loss:**
- #61 — Likes count reset to 0
- #69 — File object silently lost

**Performance:**
- #67 — N+1 Redis query
- #70 — Data URL fetch round-trip
- #56 — Object URL memory leak
- #81, #82 — GamePage optimizations (OPEN)

**Memory:**
- #56 — Object URL memory leak

**UX/Accessibility:**
- #53, #54 — Accessibility gaps
- #48, #51 — Layout and responsiveness

### By Impact Area

| Area | Issues |
|------|--------|
| **Redis Infrastructure** | #90, #89, #93, #94, #92, #67, #81 |
| **Image Pipeline** | #56, #70, #69, #74, #76 |
| **Form System** | #57, #58, #54, #75 |
| **GamePage** | #80, #81, #82, #84, #85 |
| **Design System** | #48, #49, #50, #51, #52 |
| **Validation** | #64, #71, #77 |
| **Auth/Security** | #66, #65, #77 |
| **Build Fixes** | #71, #72, #73, #76 |

---

## Contributing

When documenting new issues, follow this template:

```markdown
# Issue #N: Issue Title

## Status
✅/🔄/❌

## Category
Bug/Feature/Refactor/Performance/Security/UI-UX/Accessibility

## Depends On
<!-- List issue numbers this depends on -->

## Blocks
<!-- List issue numbers this blocks -->

## Problem Description

## Root Cause

## Solution Implemented

## Files Modified

## Testing

## Verification Checklist

## Related Issues
```

---

## Related Documentation

- Architecture: `../documentations/01-ARCHITECTURE.md`
- Authentication: `../documentations/02-AUTHENTICATION.md`
- Data Flow: `../documentations/03-DATA_FLOW.md`
- Security: `../problems/01-SECURITY_VULNERABILITIES.md`
- Known Issues: `../problems/02-KNOWN_ISSUES.md`
- GamePage Feature: `../features/GamePage/GamePage.md`

---

*45 unique issues documented. 3 currently OPEN: #81 (hotness cache), #82 (batch MongoDB fetch), #94 (remove ioredis), #95 (Zustand likes store).*
