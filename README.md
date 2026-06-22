# Deepslate Dungeons

> A dark-fantasy RPG campaign builder — create, store, and share D&D-style adventures complete with characters, maps, items, and lore. Powered by a polyglot persistence stack that runs on free tiers from day one and graduates to production scale without rewriting.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38bdf8)](https://tailwindcss.com)
[![Convex](https://img.shields.io/badge/Convex-realtime-orange)](https://convex.dev)
[![Clerk](https://img.shields.io/badge/Clerk-auth-6c47ff)](https://clerk.com)
[![Neon Postgres](https://img.shields.io/badge/Neon-Postgres-00e599)](https://neon.tech)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-13aa52)](https://mongodb.com)
[![Upstash Redis](https://img.shields.io/badge/Redis-Upstash-dc382d)](https://upstash.com)
[![Supabase Storage](https://img.shields.io/badge/Supabase-Storage-3ecf8e)](https://supabase.com)
[![PostHog](https://img.shields.io/badge/PostHog-analytics-1d4aff)](https://posthog.com)
[![Zod](https://img.shields.io/badge/Zod-4-3e67b1)](https://zod.dev)

> **45 GitHub issues · 41 closed · 4 open · dependency-mapped · knowledge-graphed · fully documented in [`documentations/issues/`](documentations/issues/)**

---

## Table of contents

- [What is this?](#what-is-this)
- [The multi-database philosophy](#the-multi-database-philosophy)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data flow](#data-flow)
- [Project structure](#project-structure)
- [UI design system](#ui-design-system)
- [Issue landscape](#issue-landscape)
- [What's unfinished](#whats-unfinished)
- [Security & known issues](#security--known-issues)
- [Knowledge graph](#knowledge-graph)
- [Documentation map](#documentation-map)
- [Environment variables](#environment-variables)
- [Development commands](#development-commands)
- [Project references](#project-references)

---

## What is this?

**Deepslate Dungeons** is a creator-first web app for building dark-fantasy TTRPG campaigns. Users launch the **Create wizard** and work through four steps:

| Step | What you build | Where it lives |
|------|----------------|----------------|
| **Game** | Name, description, tags, cover image | Neon PostgreSQL (catalog) + Redis (hot cache) |
| **Characters** | Portraits, names, lore, stats | MongoDB (flexible nested docs) |
| **Maps** | Images, place sizes, POI markers | MongoDB + Supabase Storage (WebP) |
| **Items** | Weapons, relics, consumables | MongoDB (variable-shape) |

Hit publish and the data flows through a Redis-backed background worker into the right storage tier — relational catalog in Postgres, flexible nested docs in MongoDB, hot caches in Upstash Redis, blobs in Supabase Storage — then surfaces instantly through a dark-fantasy UI built on the abyss-purple + ember-glow design system.

### Who it's for

- **Game masters** seeking a digital home for their D&D-style campaigns
- **TTRPG players** who want to browse, discover, and share adventures
- **Worldbuilders** who need structured tools for characters, maps, and items

### Current status

The app ships a working create-flow (wizard → API → worker → DB), a home page with a paginated cards grid, Clerk-powered authentication, and roughly 80% of the backend infrastructure. The two biggest gaps are the **GamePage detail view** (`/game/[uuid]`) and the **likes/state pipeline** — both are fully designed and documented but not yet wired up in code.

---

## The multi-database philosophy

Every storage backend excels at something different. This architecture assigns each data type to the tool that handles it best:

| Storage | Role | Rationale |
|---------|------|-----------|
| **Neon PostgreSQL** | Relational catalog | `games` table with indexing, joins over tags/likes, connection pooling built for serverless |
| **MongoDB + Mongoose** | Document store | Variable-shape nested arrays (characters, maps, items) — no per-campaign schema migrations |
| **Upstash Redis** | Cache + queue | Sub-millisecond reads for hot games; background job queue powering the write pipeline |
| **Supabase Storage** | Image CDN | WebP-encoded images via sharp, public bucket `deepslate-rpg`, quality 85 |
| **Convex** | Realtime (opt-in) | Scaffolded schema + functions for future real-time subscriptions |

This layered design keeps everything runnable on free tiers while deferring the cost center (realtime) to Convex only when needed.

> **Migration note:** Originally used `ioredis` with Redis Cloud. Migrated to Upstash Redis in [#93](documentations/issues/93-MIGRATE-TO-UPSTASH-REDIS.md). The `ioredis` package and legacy code still linger — see [#94](documentations/issues/94-REMOVE-IORedis.md) for cleanup.

---

## Tech stack

| Layer | Tech | Version | Purpose |
|-------|------|---------|---------|
| **Framework** | Next.js (App Router) | 16.2.4 | Server components, streaming, serverless API routes |
| **Language** | TypeScript | 5.x (strict) | Full-stack type safety |
| **UI Library** | React | 19.2.4 | Server + client components |
| **Styling** | Tailwind CSS + CSS Modules + `cn()` | v4.2.4 | Hybrid utility-class + scoped-CSS pattern |
| **Component primitives** | Radix UI + shadcn/ui | latest | Headless accessible components |
| **WebGL** | OGL | 1.0.11 | 3D visuals (future) |
| **Auth** | Clerk (`@clerk/nextjs`) | ^7.4.1 | OAuth, JWT templates, `auth()` server-side |
| **Relational DB** | Neon (`@neondatabase/serverless`) | ^1.1.0 | PostgreSQL for games catalog |
| **Document DB** | MongoDB Atlas (Mongoose) | ^9.6.2 | Characters, maps, items |
| **Cache + queue** | Upstash Redis (`@upstash/redis`) | ^1.38.0 | Hot reads + job queue |
| **Object storage** | Supabase (`@supabase/ssr` + `supabase-js`) | latest | WebP image CDN |
| **Realtime** | Convex | ^1.39.1 | Subscriptions (opt-in, scaffolded) |
| **Analytics** | PostHog (`posthog-js`) | ^1.372.10 | Events, session replay |
| **Validation** | Zod | ^4.4.3 | Centralized schemas in `types/validation.ts` |
| **Rate limiting** | Bottleneck | ^2.19.5 | Per-IP limiter via `Bottleneck.Group` |
| **State management** | Zustand | ^5.0.14 | Likes store (designed, not yet active) |
| **ID generation** | UUID | ^14.0.0 | UUID v7 for idempotency keys |
| **Image processing** | sharp | ^0.34.5 | WebP quality-85 conversion |
| **Resilience** | Custom retry (`lib/retry.ts`) | — | 2-3 retries, 500ms backoff for all DB calls |
| **WebSockets compression** | pako | ^2.1.0 | Binary compression |

Full dependency list: [`package.json`](package.json).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js 16)                               │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ CreateForm       │  │ CardsGrid      │  │ Sidebar (sticky, glass,  │  │
│  │ (wizard)         │  │ (CSS columns)  │  │ collapsible, +PostHog)   │  │
│  │ + useFormState   │  │ + FittedImage  │  │ + ProfileMenu            │  │
│  │ + ImageUpload    │  │ + ProfileCard  │  └──────────────────────────┘  │
│  │ + step validation│  │ + LikeButton   │                                │
│  └────────┬─────────┘  └──────┬─────────┘                                │
│           │                   │                                          │
│           └───────────────────┼──── sessionStorage preload (#80)         │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │ JWT (Clerk auth())
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        API ROUTES (Next.js App Router)                   │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ POST /api/push  │  │ GET /api/games │  │ POST /api/convertUrl     │  │
│  │ POST .../pushGames│ │ GET .../[id]  │  │ POST .../ConvertGameImages│  │
│  │ (Redis queue)   │  │ (read path)    │  │ (image upload + WebP)     │  │
│  │ + idempotency   │  │ + pagination   │  │ + AbortController         │  │
│  │ + retry()       │  │ + redis.mget   │  │ + binary conversion       │  │
│  │ + JWT validation │  │ + cache warmup │  │ + progress tracking       │  │
│  └────────┬────────┘  └──────┬─────────┘  └───────────┬──────────────┘  │
│           │                  │                         │                 │
│           └──────────────────┴─────────────────────────┘                 │
│                                   │                                      │
│    validateJWTMiddleware() — all routes protected via auth()              │
│    tryApiRoute() — unified error boundary with classifyError()           │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          BACKEND SERVICES                                 │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     Background Worker                              │  │
│  │  lib/GamesInsert.ts — processGamesQueue()                          │  │
│  │  → Dequeues jobs from Redis → insertGame() to Neon PostgreSQL      │  │
│  │  → Creates MongoDB docs (characters/maps/items)                    │  │
│  │  → warmUpCache() → ensures cache is primed                         │  │
│  │  → classifyError() → unified error classification                  │  │
│  │  → retry() wrapper on ALL DB operations (#78)                      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │   Upstash Redis  │  │  Neon PostgreSQL  │  │   MongoDB (Mongoose)  │  │
│  │   ┌────────────┐ │  │  ┌─────────────┐ │  │  ┌──────────────────┐ │  │
│  │   │ Hot cache  │ │  │  │ games table │ │  │  │ GameData (nested)│ │  │
│  │   │ Job queue  │ │  │  │ (catalog)   │ │  │  │ characters[]     │ │  │
│  │   │ Queue cfg  │ │  │  │ pagination  │ │  │  │ maps[]           │ │  │
│  │   │ Likes queue│ │  │  │ likes count │ │  │  │ items[]          │ │  │
│  │   └────────────┘ │  │  └─────────────┘ │  │  └──────────────────┘ │  │
│  └──────────────────┘  └──────────────────┘  └────────────────────────┘  │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ Supabase Storage │  │    Convex        │  │  PostHog              │  │
│  │ (WebP images)    │  │ (opt-in realtime)│  │  (event capture)      │  │
│  │ bucket: deepslate│  │ schema + fns     │  │  instrumentation.ts   │  │
│  └──────────────────┘  └──────────────────┘  └────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      Cache Layer (Redis)                            │  │
│  │  ┌─────────────────┐  ┌────────────────┐  ┌─────────────────────┐  │  │
│  │  │ games:list      │  │ game:{uuid}    │  │ cache:ids (sorted)  │  │  │
│  │  │ (paginated)     │  │ (single game)  │  │ for pagination     │  │  │
│  │  └─────────────────┘  └────────────────┘  └─────────────────────┘  │  │
│  │  warmUpCache() populates all three on startup                       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Core abstractions** (most-connected nodes per knowledge graph):

- `classifyError()` — 54 edges (unified error classification across all modules)
- `tryApiRoute()` — 22 edges (request boundary wrapper)
- `Upstash Redis SDK` — 22 edges (cache + queue)
- `validateJWTMiddleware()` — 20 edges (auth gate)

---

## Data flow

### Game creation pipeline

```
CreateForm wizard
  → POST /api/push (validate, generate UUID v7, push to Redis queue)
  → Background worker (lib/GamesInsert.ts: processGamesQueue)
    → insertGame() to Neon PostgreSQL (catalog: name, desc, tags, likes)
    → insertGameData() to MongoDB (nested: characters, maps, items)
    → warmUpCache() backfills Redis
  → Client polls or redirects to home page
```

### Game read pipeline

```
GET /api/games[?cursor=&limit=]
  → 1. checkCachePrimed() — ensures warmup ran
  → 2. getCachedGameIds() — sorted set from Redis
  → 3. getGameFromCache() — mget from Redis hash
  → 4. MISS: getGameById() from PostgreSQL + merge MongoDB data
  → 5. backfillCache() — set result in Redis
```

### Planned: GamePage detail flow (#80, #81, #82)

```
ProfileCard click → sessionStorage.setItem()
  → router.push(/game/[uuid])
  → game-detail.tsx mounts, reads sessionStorage for instant hero render
  → GET /api/games/[uuid] for full data (characters, maps, items)
    → Hotness cache check (binary-search sorted array, #81)
    → MISS: Redis batch queue → batch MongoDB fetch (#82)
    → Response with FullGameResponse type (#84)
```

---

## Project structure

```
deepslate dungeons/
│
├── app/                          # Next.js 16 App Router
│   ├── layout.tsx                # Root layout — fonts (Cormorant + DM Sans), ConvexProvider
│   ├── page.tsx                  # Home page — CardsGrid + CardsGridWrapper
│   ├── globals.css               # Design tokens (@theme) + glass/glow utilities
│   ├── auth-gate.tsx             # Auth overlay for unauthenticated users
│   ├── convex-client-provider.tsx
│   ├── game/                     # [uuid]/page.tsx — NOT YET IMPLEMENTED
│   ├── inventory/                # User inventory page
│   ├── profile/                  # Profile page
│   ├── settings/                 # Settings page
│   └── api/
│       ├── games/                # GET (list), GET [id] (detail)
│       ├── push/                 # POST (create game), POST pushGames
│       ├── convertUrl/           # POST (image upload), POST ConvertGameImages
│       ├── drain/                # POST (queue drain)
│       ├── patches/              # PATCH (game patches)
│       └── test/                 # Test supabase auth
│
├── components/
│   ├── adventures/               # CreateForm wizard, CardsGrid, ProfileCard
│   ├── authentication/           # Login/signup UI
│   ├── background/               # Sidebar, ProfileMenu, layout shells
│   ├── game/                     # GamePage components — NOT YET IMPLEMENTED
│   └── shared/                   # FittedImage (next/image wrapper)
│
├── convex/                       # Convex schema + functions (opt-in realtime)
│   ├── schema.ts                 # games, characters, maps, items tables
│   ├── auth.config.ts            # Clerk auth integration
│   ├── authHelpers.ts            # requireAuth(), requireStaff()
│   ├── games.ts                  # CRUD + auth guards
│   ├── characters.ts, maps.ts, items.ts, staff.ts
│   └── _generated/               # Auto-generated Convex types
│
├── lib/                          # Server utilities
│   ├── db.ts                     # 7 PostgreSQL functions wrapped in retry()
│   ├── queue.ts                  # Upstash Redis client (legacy ioredis commented out)
│   ├── retry.ts                  # Exponential-backoff retry helper
│   ├── cache-warmup.ts           # ensureCachePrimed(), warmUpCache()
│   ├── jwt-validate.ts           # Clerk auth() wrapper
│   ├── storage.ts                # Supabase upload helper
│   ├── auth.ts                   # createAuthenticatedSupabaseClient()
│   ├── patch-applier.ts          # applyGamePatches()
│   ├── GamesInsert.ts            # Background worker: processGamesQueue()
│   ├── pull.ts                   # Worker entry point
│   └── middleware/
│       └── rate-limit.ts         # Bottleneck.Group per-IP
│
├── hooks/
│   ├── useFormState.ts           # Shared form state (#58)
│   ├── useAuth.ts                # Client auth hook (#73 — name conflict resolved)
│   ├── useIdempotentRequest.ts   # UUID v7 + AbortController
│   ├── useMutationTracker.ts     # Track mutation progress
│   ├── useGameCache.ts           # Cache preload helpers
│   ├── useGamePreload.ts         # + Zustand store
│   └── useGameForm.ts            # Form hook for wizard
│
├── ui/
│   ├── primitives/               # Button, Card, Input, Textarea, Label, ErrorPageShell
│   └── notifications/            # use-toast, toaster (Radix-based)
│
├── exceptions/                   # Importable error pages
│   ├── errorPages/               # NotFound (404), ServerError (500), Forbidden (403),
│   │                             # ServiceUnavailable (503), BadRequest (400), General
│   └── notifications/            # Toast notifications, SuccessToast, Toaster
│
├── styles/                       # CSS Modules
│   ├── pages/                    # home, inventory
│   ├── layout/                   # root layout
│   ├── cards/                    # CardsGrid, CardsLoad, cards
│   ├── forms/                    # form, wizard
│   ├── sidebar/                  # sidebar
│   ├── authentication/           # unauthenticated
│   ├── auth/                     # signup, auth-status
│   └── shared/                   # fitted-image
│
├── types/                        # Shared TypeScript types
│   ├── validation.ts             # Zod-inferred types (single source of truth)
│   ├── cards.ts                  # CardProps, GameCardProps
│   └── db.ts                     # DB row types
│
├── models/
│   └── games/mongodb/            # Mongoose GameData schema
│
├── utilities/
│   ├── clientUtilities/          # Browser-only helpers
│   ├── imagesUtils.ts            # WebP conversion, base64 encode/decode
│   ├── sleep.ts                  # Shared sleep() (#60 — deduplicated)
│   └── validation.ts             # Zod schemas for form steps (#77)
│
├── documentations/               # Full project documentation
│   ├── documentations/           # System docs (architecture, auth, data flow, UI)
│   ├── guides/                   # How-to guides (JWT setup, API implementation)
│   ├── problems/                 # Security audit + known performance issues
│   ├── features/                 # Feature specs (GamePage, DataStructures)
│   ├── discussions/              # Security discussions (CSRF, idempotency, etc.)
│   └── issues/                   # 45 documented GitHub issues
│
├── graphify-out/                 # Auto-extracted knowledge graph
│   ├── GRAPH_REPORT.md           # Full audit (2,608 nodes, 3,143 edges, 188 communities)
│   ├── graph.html                # Interactive browser graph
│   ├── graph.json                # Raw graph data
│   └── .graphify_labels.json     # Human-readable community labels
│
├── .agents/skills/               # Project-local agent skills (16 skills)
│
├── proxy.ts                      # Clerk middleware (route protection)
├── next.config.ts                # Supabase hostname, image quality 85
├── instrumentation-client.ts     # PostHog client init
├── package.json
└── README.md                     # ← you are here
```

---

## UI design system

Defined in [`app/globals.css`](app/globals.css) via Tailwind v4 `@theme`. Hybrid pattern: **CSS Modules for structure + Tailwind utilities for variants**.

### Theme tokens

| Category | Tokens | Values |
|----------|--------|--------|
| **Abyss palette** | `--color-abyss-950` → `--color-abyss-100` | Deepest bg (`#05020d`) → subtle accent (`#e3ddf2`) |
| **Ember glow** | `--color-ember-600` → `--color-ember-100` | Dark ember (`#7c2d12`) → light glow (`#ffedd5`) |
| **Semantic** | `bg-base`, `bg-surface`, `text-primary`, `accent` | Mapped from palette |
| **Glass** | `.bg-glass` | Frosted backdrop with blur |
| **Glow** | `.glow-accent`, `.glow-accent-sm` | Ember box-shadow glow |
| **Gradient text** | `.text-gradient`, `.text-gradient-accent` | CSS gradient fill |

### Pattern

```tsx
import { cn } from "@/lib/utils";
import styles from "@/styles/xxx/xxx.module.css";

<div className={cn(styles.structuralClass, "tailwind-utility", condition && styles.variantClass)}>
```

### Fonts

- **Display (headings):** Cormorant Garamond (`--font-display`)
- **Sans (body):** DM Sans (`--font-sans`)

Full design system: [`documentations/documentations/04-UI_DESIGN_SYSTEM.md`](documentations/documentations/04-UI_DESIGN_SYSTEM.md).

---

## Issue landscape

**45 documented issues · 41 closed · 4 open · 11 dependency chains · 10 impact areas**

Every issue is documented in [`documentations/issues/`](documentations/issues/) with: problem description, root cause, solution, code examples, dependency tracking, and verification checklists.

### Dependency graph

```
#66 ─── #65                    Security (JWT → rate limiter)
#71 ─── #77 ← #64             Validation (ZodError → centralization)
#67 ─── #78 ← #62             Backend reliability (N+1 → retry → cache helpers)
#56 ─── #70 ─┬─ #69           Image pipeline (memory leak → data URL → file loss)
             ├─ #74 ── #76    (abort crash → docs)
#57 ─── #58 ─── #54 ── #75   Form layer (prop drill → hooks → a11y → styles)
#48 ─── #50 ─── #51           Design system (layout → tokens → responsive)
#49 ─── #52                    Architecture (rendering → coupling)
#90 ─┬─ #89 ── #95            Likes pipeline (queues → instant write → Zustand)
     ├─ #91                    State sync (JSON Patch)
     ├─ #92                    Dead code (remove load key)
     └─ #93 ── #94            Redis migration (Upstash → remove ioredis)
#80 ─┬─ #81 ── #82 ── #84 ── #85  GamePage suite (nav → cache → batch → UI → a11y)
```

### Open issues (4)

| # | Issue | Status | Blocks | Area |
|---|-------|--------|--------|------|
| **81** | Binary-search hotness cache | 🔄 OPEN | #82 | GamePage (Performance) |
| **82** | Batch MongoDB fetch via Redis queue | 🔄 OPEN | #84 | GamePage (Performance) |
| **94** | Remove ioredis dependency | 🔄 OPEN | — | Cleanup |
| **95** | Zustand Likes Store | 🔄 OPEN | — | Likes/State |

### Closed by impact area

| Area | Issues | Status |
|------|--------|--------|
| **Image Pipeline** | #56, #70, #69, #74, #76 | ✅ All closed |
| **Form System** | #57, #58, #54, #75 | ✅ All closed |
| **Design System** | #48, #50, #51, #49, #52 | ✅ All closed |
| **Validation** | #64, #71, #77 | ✅ All closed |
| **Auth/Security** | #66, #65 | ✅ All closed |
| **Build Fixes** | #71, #72, #73, #76 | ✅ All closed |
| **Accessibility** | #53, #54, #85 | ✅ All closed |
| **Backend Reliability** | #67, #78, #62 | ✅ All closed |
| **Likes (partially)** | #90, #89, #91, #92, #93 | ✅ All closed (except #94, #95) |
| **GamePage (partially)** | #80, #84, #85 | ✅ Closed (except #81, #82) |

---

## What's unfinished

Honest accounting of what's NOT done yet. Updated 2026-06-10.

### 🟥 Open issues (4)

#### Issue #81: Binary-search hotness cache
- **Problem:** Redis cache uses unconditional `SET` with static TTL — every requested game gets cached regardless of popularity, wasting memory on long-tail games
- **Designed solution:** In-memory hashmap + parallel arrays + binary search for O(log n) insertion
- **Files to create:** `lib/hotness-cache.ts`
- **Blocks:** #82

#### Issue #82: Batch MongoDB fetch via Redis queue
- **Problem:** Each `GET /api/games/[id]` does a direct `Game.findOne()` — connection pool saturates under 100+ concurrent requests
- **Designed solution:** Redis-backed batch pipeline (LPUSH → worker → `Game.find({ id: { $in } })` → fan out via HSET + PUBLISH)
- **Files to create:** `utilities/batchFetchWorker.ts`
- **Depends on:** #80, #81

#### Issue #94: Remove ioredis dependency
- **Problem:** `ioredis` package (v5.10.1) and its commented-out legacy code remain in `lib/queue.ts` and `package.json`
- **Actionable:** Uninstall `ioredis`, delete commented block, remove `redisqueue` env var
- **Depends on:** #93 (Upstash migration — done ✅)

#### Issue #95: Zustand Likes Store
- **Problem:** Likes system needs a client-side store for optimistic updates and fire-and-forget writes
- **Status:** Designed, not implemented
- **Depends on:** #89 (Likes instant write — done ✅)

### 🟧 Production checklist (3 incomplete)

| # | Item | Status |
|---|------|--------|
| 8 | Audit logging (failed-auth, data mods, unusual access) | 🔲 Not started |
| 9 | WAF + request signing | 🔲 Not started |
| 10 | Penetration test | 🔲 Not started |

Items 1-7 are completed (CORS allow-list, size limits, security headers, rate limiting, JWT migration, etc.).

### 🟨 Known performance issues (not yet addressed in code)

From [`documentations/problems/02-KNOWN_ISSUES.md`](documentations/problems/02-KNOWN_ISSUES.md):

| Issue | Risk | Status |
|-------|------|--------|
| Cache stampede (multiple requests on miss) | High | Designed (locking), not implemented |
| N+1 MongoDB queries in loops | High | Mitigated by retry, batch queuing in #82 |
| Memory exhaustion from unbounded cache | Medium | Addressed by #81's barrier-to-entry eviction |
| Dual-DB sync race (PostgreSQL vs MongoDB) | High | Saga pattern designed, not in worker |
| Cache/DB divergence on partial writes | Medium | TTL-based eventual consistency |
| No performance metrics / alerting | Medium | No monitoring implemented |

### 🟨 Knowledge graph blind spots

The auto-extracted graph ([`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md)) flagged **1,634 isolated nodes** with one or fewer connections. These are files, types, and utilities that may lack documentation or integration tracking. See the full report for the isolated node list.

### 🟨 GamePage detail route (`/game/[uuid]`)

The full GamePage (detail view for a single adventure) is **designed but not implemented**. The feature spec at [`documentations/features/GamePage/GamePage.md`](documentations/features/GamePage/GamePage.md) (614 lines) covers:
- Server component shell + SEO metadata generation
- Client component with sessionStorage preload from ProfileCard
- Three-tier cache check (client → hotness → Redis → batch MongoDB)
- FullGameResponse type + 4 UI component cards (GameHeader, CharacterCard, MapCard, ItemCard)
- Responsive layout + accessibility verification (#85)

**Files that don't exist yet:**
- `app/game/[uuid]/page.tsx` (server component)
- `app/game/[uuid]/game-detail.tsx` (client component)
- `components/game/GameHeader.tsx`
- `components/game/CharacterCard.tsx`
- `components/game/MapCard.tsx`
- `components/game/ItemCard.tsx`
- `lib/hotness-cache.ts` (#81)
- `utilities/batchFetchWorker.ts` (#82)

### 🟨 Data integrity gaps

- **No zero-downtime deployment** strategy implemented
- **No transactional guarantees** across PostgreSQL + MongoDB writes (manual saga cleanup only)
- **No schema migration framework** for MongoDB (Mongoose schema changes require manual migration scripts)

---

## Security & known issues

### Security audit summary

From [`documentations/problems/01-SECURITY_VULNERABILITIES.md`](documentations/problems/01-SECURITY_VULNERABILITIES.md) (653 lines):

| Severity | Count | Examples | Status |
|----------|-------|----------|--------|
| 🔴 Critical | 4 | JWT secret exposure, missing CORS, unbounded request size, missing security headers | ✅ Mitigated |
| 🟠 High | 5 | No rate limiting (fixed), missing token expiration (safe), no input validation (fixed) | ✅ Mostly fixed |
| 🟡 Medium | 4 | Information disclosure, no audit logging, no API versioning | 🔲 Audit log open |
| 🟢 Low | 2 | Verbose error messages, no HTTPS enforcement (Vercel handles) | ✅ Acceptable risk |

### Known performance issues

From [`documentations/problems/02-KNOWN_ISSUES.md`](documentations/problems/02-KNOWN_ISSUES.md) (518 lines):

1. **N+1 Redis queries** — individual `GET` per game ID in list endpoint (mitigated by `redis.mget`)
2. **Cache stampede** — multiple requests hit DB on cache miss (solution designed, not implemented)
3. **Memory exhaustion** — unbounded cache growth (planned fix in #81)
4. **Slow MongoDB queries** — no indexes on `id` field (documented)
5. **PostgreSQL connection exhaustion** — pool size configured but no monitoring
6. **Dual-DB sync** — PostgreSQL + MongoDB can diverge on partial failure
7. **Cache/DB divergence** — stale data served after write

---

## Knowledge graph

The codebase is auto-extracted into a navigable knowledge graph via [graphify](https://github.com/anomalyco/graphify):

| Metric | Value |
|--------|-------|
| Nodes | 2,608 |
| Edges | 3,143 |
| Communities | 188 (159 shown, 29 thin omitted) |
| Extraction confidence | 99% extracted, 1% inferred |
| Import cycles | 1 (notifications barrel export) |

### God nodes (most-connected abstractions)

| Node | Connections | What |
|------|-------------|------|
| `classifyError()` | 54 | Unified error classification across all lib modules |
| `tryApiRoute()` | 22 | Request boundary wrapper for API routes |
| `Upstash Redis SDK` | 22 | Cache + queue client |
| `validateJWTMiddleware()` | 20 | Auth gate for API routes |
| `Deepslate Dungeons — Architecture Document` | 20 | Central reference doc |
| `PostHog Next.js app router example` | 19 | Analytics integration pattern |
| `compilerOptions` | 16 | TypeScript config |
| `Neon Serverless Postgres` | 16 | Database adapter |

### Surprising connections (auto-discovered)

- `useMutationTracker` (hooks) → `applyGamePatches` (lib/patch-applier.ts) — `[INFERRED, semantically similar]`
- `useAuth` (hooks) → `validateJWTMiddleware` (lib/jwt-validate.ts) — `[INFERRED, semantically similar]`

### Top communities (by cohesion)

| Community | Cohesion | Nodes | Theme |
|-----------|----------|-------|-------|
| Game Creation Pipeline | 0.15 | 12 | Wizard → API → Worker → DB |
| Games API Cache & Drain | 0.17 | 20 | Redis cache + queue drain |
| MongoDB Game Queue | 0.18 | 15 | Worker → MongoDB |
| Game Fetch Pipeline | 0.13 | 30 | Client read path |
| Auth & Error Classification | 0.13 | 26 | JWT + error handling |

Open [`graphify-out/graph.html`](graphify-out/graph.html) in a browser for interactive exploration, or read [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md) for the full audit.

---

## Documentation map

```
documentations/
├── documentations/              # How the system works
│   ├── 01-ARCHITECTURE.md       # System diagram, DB schemas, caching, scalability
│   ├── 02-AUTHENTICATION.md     # JWT flow, Clerk, multi-template, troubleshooting
│   ├── 03-DATA_FLOW.md          # Game lifecycle, request/response, inter-service comms
│   └── 04-UI_DESIGN_SYSTEM.md   # Design tokens, CSS Modules + cn() pattern, components
│
├── guides/                      # How to do things
│   ├── 01-JWT_SETUP.md          # Step-by-step Clerk JWT, env vars, validation, frontend
│   └── 02-API_IMPLEMENTATION.md # Route template, GET/POST, caching, idempotency, errors
│
├── problems/                    # Security & known issues
│   ├── 01-SECURITY_VULNERABILITIES.md  # 4 critical, 5 high, 4 medium, 2 low
│   └── 02-KNOWN_ISSUES.md             # N+1, cache stampede, dual-DB sync, race conditions
│
├── features/                    # Feature specs
│   ├── GamePage/
│   │   ├── GamePage.md          # Full spec (614 lines)
│   │   ├── GamePage_Integration_Guide.md
│   │   ├── GAMEPAGE_QUICKSTART.md
│   │   ├── GAMEPAGE_README.md
│   │   └── GAMEPAGE_SUMMARY.md
│   └── DataStructures.md
│
├── discussions/                 # Security discussions
│   └── security/                # CSRF, idempotency, JWT, authorization, rate limiting
│
└── issues/                      # 45 documented GitHub issues (see section above)
    ├── README.md                # Full index with dependency graph + status tracker
    └── *.md                     # Individual issues (48-95)
```

---

## Environment variables

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_BUCKET_NAME=deepslate-rpg
supabasepassword=...

# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster/?appName=...

# Redis (legacy ioredis — being removed in #94)
redisqueue=redis://default:pass@host:port

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Analytics
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

> ⚠️ **Never commit `.env` or `.env.local`.** Copy `.env.example` to `.env.local` and keep secrets in a managed store (Vercel Env / GitHub Secrets).

---

## Development commands

```bash
npm run dev          # Start Next.js dev server (Turbopack, hot reload)
npm run build        # Production build with type-checking
npm run start        # Run production server
npm run lint         # ESLint across all source files

# Convex (requires separate terminal)
npx convex dev       # Local Convex deployment with hot reload
npx convex dashboard # Open Convex web dashboard
npx convex deploy    # Deploy Convex functions to production
```

### Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npx convex dev       # Terminal 1
npm run dev          # Terminal 2
```

Open http://localhost:3000. Clerk handles sign-in, the wizard walks you through creating your first game, and PostHog records the visit.

---

## Project references

### Agent skills (`.agents/skills/`)

| Skill | Use for |
|-------|---------|
| [`project-reference/`](.agents/skills/project-reference/Skill.md) | Route to any project file or skill |
| [`convex/`](.agents/skills/convex/SKILL.md) | Convex skill router — routes to the right Convex skill |
| [`convex-quickstart/`](.agents/skills/convex-quickstart/SKILL.md) | First Convex setup |
| [`convex-setup-auth/`](.agents/skills/convex-setup-auth/SKILL.md) | Convex auth + users table |
| [`convex-create-component/`](.agents/skills/convex-create-component/SKILL.md) | Reusable Convex components |
| [`convex-migration-helper/`](.agents/skills/convex-migration-helper/SKILL.md) | Schema + data migrations |
| [`convex-performance-audit/`](.agents/skills/convex-performance-audit/SKILL.md) | Performance audit |
| [`neon-postgres/`](.agents/skills/neon-postgres/SKILL.md) | Neon best practices |
| [`redis-development/`](.agents/skills/redis-development/SKILL.md) | Redis data structures + search |
| [`upstash-redis-js/`](.agents/skills/upstash-redis-js/SKILL.md) | Upstash Redis SDK |
| [`integration-nextjs-app-router/`](.agents/skills/integration-nextjs-app-router/SKILL.md) | PostHog + Next.js |
| [`self-assessment/`](.agents/skills/self-assessment/Skill.md) | Full project + team assessment |
| [`ui-design/`](.agents/skills/ui-design/SKILL.md) | UI design best practices |
| [`ui-ux-pro-max/`](.agents/skills/ui-ux-pro-max/SKILL.md) | 50+ styles, 161 color palettes, 57 font pairings |
| [`web-design-guidelines/`](.agents/skills/web-design-guidelines/SKILL.md) | Web Interface Guidelines compliance |
| [`documentation/`](.agents/skills/documentation/SKILL.md) | Technical writing |
| [`references/`](.agents/skills/references/SKILL.md) | Authoritative external docs index |

### Root reference files

| File | What |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | Agent instructions with anchored project summary |
| [`JWT_IMPLEMENTATION_SUMMARY.md`](JWT_IMPLEMENTATION_SUMMARY.md) | Quick JWT changes summary |
| [`JWT_VALIDATION_GUIDE.md`](JWT_VALIDATION_GUIDE.md) | Detailed JWT validation |
| [`posthog-setup-report.md`](posthog-setup-report.md) | PostHog setup report |
| [`architicture/architecture.md`](architicture/architecture.md) | Architecture overview |
| [`convex/_generated/ai/guidelines.md`](convex/_generated/ai/guidelines.md) | **Always read first** for Convex code |

### Knowledge graph

| File | What |
|------|------|
| [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md) | Full audit (2,608 nodes, 188 communities) |
| [`graphify-out/graph.html`](graphify-out/graph.html) | Interactive graph in browser |
| [`graphify-out/graph.json`](graphify-out/graph.json) | Raw graph data (3,143 edges) |

### Authoritative external docs

[Next.js 16](https://nextjs.org/docs) · [React 19](https://react.dev) · [Tailwind v4](https://tailwindcss.com/docs) · [Convex](https://docs.convex.dev) · [Clerk Next.js](https://clerk.com/docs/quickstarts/nextjs) · [Neon](https://neon.tech/docs) · [Mongoose](https://mongoosejs.com/docs) · [Upstash Redis](https://upstash.com/docs) · [Supabase Storage](https://supabase.com/docs/guides/storage) · [PostHog JS](https://posthog.com/docs/libraries/js) · [Zod](https://zod.dev) · [Bottleneck](https://github.com/SGrondin/bottleneck) · [Radix UI](https://www.radix-ui.com) · [shadcn/ui](https://ui.shadcn.com) · [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
