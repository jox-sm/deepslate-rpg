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

> **45 GitHub issues (#48–#95) · dependency-mapped · knowledge-graphed · fully documented in [`documentations/issues/`](documentations/issues/)**

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
| **Game** | Name, description, tags, cover image | Neon PostgreSQL (catalog) + Upstash Redis (hot cache) |
| **Characters** | Portraits, names, lore, stats | MongoDB (flexible nested docs) |
| **Maps** | Images, place sizes, POI markers | MongoDB + Supabase Storage (WebP) |
| **Items** | Weapons, relics, consumables | MongoDB (variable-shape) |

Hit publish and the data flows through an Upstash-Redis-backed queue into the right storage tier — relational catalog in Postgres, flexible nested docs in MongoDB, hot caches in Upstash Redis, blobs in Supabase Storage — then surfaces instantly through a dark-fantasy UI built on the **Stone/Slate + Torchlight** design system.

### Who it's for

- **Game masters** seeking a digital home for their D&D-style campaigns
- **TTRPG players** who want to browse, discover, and share adventures
- **Worldbuilders** who need structured tools for characters, maps, and items

### Current status

The app ships a working create-flow (wizard → API → worker → DB), a home page with a paginated cards grid, the **GamePage detail view** (`/game/[uuid]`), the **Play screen** (`/play`), a client **likes store** with optimistic updates, the **hotness cache**, and an **AI server integration** that relays to a FastAPI backend. Clerk powers authentication and Convex is an opt-in realtime scaffold (not on the primary write path). The largest remaining gaps are production hardening items — audit logging, WAF + request signing, monitoring/alerting, and transactional guarantees across Postgres + MongoDB.

---

## The multi-database philosophy

Every storage backend excels at something different. This architecture assigns each data type to the tool that handles it best:

| Storage | Role | Rationale |
|---------|------|-----------|
| **Neon PostgreSQL** | Relational catalog | `games` table with indexing, joins over tags/likes, connection pooling built for serverless |
| **MongoDB + Mongoose** | Document store | Variable-shape nested arrays (characters, maps, items) — no per-campaign schema migrations |
| **Upstash Redis** | Cache + queue | Sub-millisecond reads for hot games; background job queue powering the write pipeline |
| **Supabase Storage** | Image CDN | WebP-encoded images via sharp, public bucket `deepslate-rpg`, quality 80 |
| **Convex** | Realtime (opt-in) | Scaffolded schema + functions for future real-time subscriptions |

This layered design keeps everything runnable on free tiers while deferring the cost center (realtime) to Convex only when needed.

> **Migration note:** Originally used `ioredis` with Redis Cloud. Migrated to Upstash Redis in [#93](documentations/issues/93-MIGRATE-TO-UPSTASH-REDIS.md) and the legacy `ioredis` dependency was fully removed in [#94](documentations/issues/94-REMOVE-IORedis.md). `lib/queue.ts` now exports a single Upstash `Redis` client; only a commented-out legacy block remains.

---

## Tech stack

| Layer | Tech | Version | Purpose |
|-------|------|---------|---------|
| **Framework** | Next.js (App Router) | 16.2.4 | Server components, streaming, serverless API routes |
| **Language** | TypeScript | ^5 (strict) | Full-stack type safety |
| **UI Library** | React | 19.2.4 | Server + client components |
| **Styling** | Tailwind CSS v4 + CSS Modules + `cn()` | tailwindcss ^4.2.4, @tailwindcss/postcss ^4.2.4 | Hybrid utility-class + scoped-CSS pattern |
| **Component primitives** | Radix UI + shadcn/ui | radix-ui ^1.4.3, shadcn ^4.7.0 | Headless accessible components |
| **Class utilities** | clsx + tailwind-merge + cva | clsx ^2.1.1, tailwind-merge ^3.5.0, class-variance-authority ^0.7.1 | `cn()` helper in `lib/utils.ts` |
| **WebGL** | OGL | ^1.0.11 | 3D visuals (future) |
| **Auth** | Clerk (`@clerk/nextjs`) | ^7.4.1 | OAuth, `auth()` server-side |
| **Relational DB** | Neon (`@neondatabase/serverless`) | ^1.1.0 | PostgreSQL for games catalog |
| **Connection pool** | `pg` | ^8.20.0 | Node Postgres driver under Neon |
| **Document DB** | MongoDB Atlas (mongodb + Mongoose) | mongodb ^7.2.0, mongoose ^9.6.2 | Characters, maps, items |
| **Cache + queue** | Upstash Redis (`@upstash/redis`) | ^1.38.0 | Hot reads + job queue |
| **Object storage** | Supabase (`@supabase/ssr` + `supabase-js`) | @supabase/ssr ^0.10.3, supabase-js ^2.105.4 | WebP image CDN |
| **Realtime** | Convex | ^1.39.1 | Subscriptions (opt-in, scaffolded) |
| **Analytics** | PostHog (`posthog-js`) | ^1.372.10 | Events, session replay |
| **Validation** | Zod | ^4.4.3 | Centralized schemas in `types/validation.ts` |
| **Rate limiting** | Bottleneck | ^2.19.5 | Per-IP limiter via `Bottleneck.Group` |
| **State management** | Zustand | ^5.0.14 | Client likes store (persisted) |
| **ID generation** | UUID | ^14.0.0 | UUID v7 for idempotency keys |
| **Image processing** | sharp | ^0.34.5 | WebP quality-80 conversion |
| **Compression** | pako | ^2.1.0 | Gzip for hotness-cache payloads |

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
│  └────────┬─────────┘  └──────┬─────────┘  ┌──────────────────────────┐  │
│           │                   │            │ GamePage /game/[uuid]    │  │
│           │                   │            │ game-detail.tsx + tabs   │  │
│           │                   │            │ Play /play → PlayScreen   │  │
│           └───────────────────┴────────────┴──────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────────┘
                                 │ Clerk auth() (server) / useAuth (client)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        API ROUTES (Next.js App Router)                   │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ POST /api/push  │  │ GET /api/games │  │ POST /api/convertUrl     │  │
│  │ POST .../pushGames│ │ GET .../[id]  │  │ POST .../ConvertGameImages│  │
│  │ (Redis queue)   │  │ (read path)    │  │ (image upload + WebP 80) │  │
│  │ + idempotency   │  │ + pagination   │  │ + AbortController         │  │
│  │ + retry()       │  │ + redis.mget   │  │ + binary conversion      │  │
│  │ + JWT validation │  │ + cache warmup │  │ + progress tracking       │  │
│  └────────┬────────┘  └──────┬─────────┘  └───────────┬──────────────┘  │
│           │                  │                         │                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ POST/GET/PUT/DELETE /api/ai-server/[...path]  → relays to FastAPI   │ │
│  │ POST /api/games/[sid]/memory                 → AI memory restore    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                   │                                      │
│    validateJWTMiddleware() — routes gated via Clerk auth()               │
│    tryApiRoute() — unified error boundary with classifyError()           │
└───────────────────────────────────┼──────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          BACKEND SERVICES                                 │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     Background Worker                              │  │
│  │  utilities/pull.ts — drainLikes / drainGames                       │  │
│  │  lib/GamesInsert.ts — processGamesQueue()                          │  │
│  │  → Dequeues jobs from Upstash Redis                                │  │
│  │  → insertGame() to Neon PostgreSQL (catalog)                       │  │
│  │  → Game.insertMany() to MongoDB (characters/maps/items)            │  │
│  │  → warmUpCache() → ensures cache is primed                         │  │
│  │  → classifyError() → unified error classification                  │  │
│  │  → retry() wrapper on ALL DB operations                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │   Upstash Redis  │  │  Neon PostgreSQL  │  │   MongoDB (Mongoose)  │  │
│  │   ┌────────────┐ │  │  ┌─────────────┐ │  │  ┌──────────────────┐ │  │
│  │   │ Hot cache  │ │  │  │ games table │ │  │  │ GameData (nested)│ │  │
│  │   │ Job queue  │ │  │  │ (catalog)   │ │  │  │ characters[]     │ │  │
│  │   │ Idempotency│ │  │  │ pagination  │ │  │  │ maps[]           │ │  │
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

- `classifyError()` — 62 edges (unified error classification across all modules)
- `cn()` — 31 edges (class-merge helper used everywhere)
- `retry()` — 30 edges (DB/Redis resilience wrapper)
- `tryApiRoute()` — 22 edges (request boundary wrapper)
- `validateJWTMiddleware()` — 20 edges (auth gate)
- `@upstash/redis SDK` — 15 edges (cache + queue)

---

## Data flow

### Game creation pipeline

```
CreateForm wizard
  → POST /api/push (validate, generate UUID v7, push to Redis queue, withIdempotency)
  → Background worker (utilities/pull.ts → lib/GamesInsert.ts: processGamesQueue)
    → insertGame() to Neon PostgreSQL (catalog: name, desc, tags, likes)
    → Game.insertMany() to MongoDB (nested: characters, maps, items)
    → warmUpCache() backfills Redis
  → Client polls or redirects to home page
```

### Game read pipeline

```
GET /api/games[?page=&limit=]
  → ensureCachePrimed() — cacheInitialized flips true ONLY after a successful warmUpCache()
  → getCachedGameIds() — sorted set from Redis
  → getGameFromCache() — mget from Redis hash
  → MISS: getGamesPaginated() from PostgreSQL + mergePendingLikesBatch()
  → backfillCache() — set result in Redis
  → If warmUpCache() failed, list reads fall back to PostgreSQL directly
```

### GamePage detail flow (`/game/[uuid]`)

```
ProfileCard click → localStorage/router navigation
  → app/game/[uuid]/page.tsx (server) loads basic info + generateMetadata
  → game-detail.tsx (client) mounts, reads useGamePreload() for instant hero render
  → GET /api/games/[id] for full data (characters, maps, items)
    → Hotness cache check (binary-search sorted array, pako-gzip)
    → cacheHit() / cacheMiss() promotion via utilities/hotnessCache.ts
    → Response with FullGameResponse type
```

### Play / AI server flow (`/play`, `/play/[sid]`)

```
ScenarioEntry → /play/[sid] → PlayGate (auth + scenario load)
  → lib/playClient.ts issues requests to /api/ai-server/[...path]
  → app/api/ai-server/[...path]/route.ts relays to FastAPI (AI_SERVER_URL, default 127.0.0.1:8000)
  → lib/ai-server-client.ts types the queue/state/memory/counter endpoints
```

### Likes flow

```
LikeButton → stores/likes-store.ts (zustand + persist)
  → optimistic update of likedGameIds / likeCounts
  → POST /api/push { type: "like", data: { id, likesDelta } } (UUID v7 idempotency key)
  → worker drains likes queue → PostgreSQL updateGameLikes()
  → on failure, _revert() rolls back the optimistic state
```

---

## Project structure

```
deepslate dungeons/
│
├── app/                          # Next.js 16 App Router
│   ├── layout.tsx                # Root layout — fonts (Cormorant + DM Sans), ConvexClientProvider
│   ├── page.tsx                  # Home page — CardsGrid + CardsGridWrapper
│   ├── globals.css               # Design tokens (@theme) + glass/glow/gradient utilities
│   ├── auth-gate.tsx             # Auth overlay for unauthenticated users
│   ├── convex-client-provider.tsx
│   ├── game/                     # [uuid]/page.tsx + game-detail.tsx (IMPLEMENTED)
│   ├── play/                     # page.tsx (ScenarioEntry) + [sid]/page.tsx (PlayGate)
│   ├── inventory/                # User inventory page
│   ├── profile/                  # Profile page
│   ├── settings/                 # Settings page
│   └── api/
│       ├── games/                # GET (list), GET [id] (detail), [id]/patches, [sid]/memory
│       ├── push/                 # POST (create game), POST pushGames
│       ├── convertUrl/           # POST (image upload), POST ConvertGameImages
│       ├── ai-server/            # [...path] relay to FastAPI
│       ├── drain/                # GET (queue drain)
│       └── test/                 # Test supabase auth
│
├── components/
│   ├── adventures/               # CreateForm wizard, CardsGrid, ProfileCard
│   ├── authentication/           # Login/signup UI
│   ├── background/               # Sidebar, ProfileMenu, layout shells
│   ├── game/                     # GamePage + Play: GameHeader, CharacterTabs, MapList,
│   │                             #   ItemGrid, PlayScreen, PlayGate, ScenarioEntry
│   └── shared/                   # FittedImage (next/image wrapper)
│
├── convex/                       # Convex schema + functions (opt-in realtime)
│   ├── schema.ts                 # games, characters, maps, items tables
│   ├── auth.config.ts            # Clerk auth integration
│   ├── authHelpers.ts            # requireAuth(), requireStaff() + staff RBAC
│   ├── games.ts                  # CRUD + auth guards
│   ├── characters.ts, maps.ts, items.ts, staff.ts
│   └── _generated/               # Auto-generated Convex types
│
├── lib/                          # Server utilities
│   ├── db.ts                     # PostgreSQL functions wrapped in retry()
│   ├── queue.ts                  # Upstash Redis client (single export)
│   ├── retry.ts                  # Exponential-backoff retry helper
│   ├── cache-warmup.ts           # ensureCachePrimed(), warmUpCache()
│   ├── jwt-validate.ts           # Clerk auth() wrapper (validateJWTMiddleware)
│   ├── storage.ts                # Supabase upload helper
│   ├── auth.ts                   # createAuthenticatedSupabaseClient()
│   ├── patch-applier.ts          # applyGamePatches()
│   ├── GamesInsert.ts            # Background worker: processGamesQueue()
│   ├── ai-server-client.ts       # Typed FastAPI client
│   └── middleware/
│       └── rate-limit.ts         # Bottleneck.Group per-IP
│
├── stores/
│   └── likes-store.ts            # Zustand + persist likes store (optimistic + revert)
│
├── utilities/
│   ├── clientUtilities/          # Browser-only helpers (useGameCache, useGamePreload)
│   ├── imagesUtils.ts            # WebP conversion (quality 80), base64, upload controller
│   ├── hotnessCache.ts           # Binary-search hotness cache + pako-gzip
│   ├── hotnessCacheWithRetry.ts  # redisWithExponentialRetry()
│   ├── idempotency.ts            # withIdempotency() (idempotency:<key>, TTL 300s)
│   ├── gameFetchPipeline.ts      # Batch fetch pipeline to Redis queue
│   ├── errorHandler.ts           # classifyError() + mapToComponent()
│   ├── apiErrorHandler.ts        # tryApiRoute()
│   ├── sleep.ts                  # Shared sleep()
│   └── validation.ts             # Zod schemas for form steps
│
├── hooks/
│   ├── useFormState.ts           # Shared form state
│   ├── useAuth.ts                # Client auth hook
│   ├── useIdempotentRequest.ts   # UUID v7 + AbortController
│   ├── useMutationTracker.ts     # Track mutation progress
│   ├── useGameCache.ts            # Cache preload helpers
│   ├── useGamePreload.ts          # + Zustand store
│   └── useGameForm.ts             # Form hook for wizard
│
├── ui/
│   ├── primitives/               # Button, Card, Input, Textarea, Label, ErrorPageShell
│   └── notifications/            # use-toast, toaster (Radix-based)
│
├── exceptions/                   # Importable error pages
│   ├── errorPages/               # NotFound (404), ServerError (500), Forbidden (403),
│   │                             # ServiceUnavailable (503), BadRequest (400), General
│   └── notifications/           # Toast notifications, SuccessToast, Toaster
│
├── styles/                       # CSS Modules
│   ├── pages/  layout/  cards/  forms/  sidebar/
│   ├── authentication/  auth/  shared/
│
├── types/                        # Shared TypeScript types
│   ├── validation.ts             # Zod-inferred types (single source of truth)
│   ├── cards.ts                  # CardProps, GameCardProps
│   ├── db.ts                     # DB row types
│   ├── ai-server.ts              # AI server response types
│   └── gamePage.ts               # GamePage props
│
├── models/
│   └── games/mongodb/            # Mongoose GameData schema + client
│
├── documentations/               # Full project documentation
│   ├── documentations/           # System docs (architecture, auth, data flow, UI)
│   ├── guides/                   # How-to guides (JWT setup, API implementation)
│   ├── problems/                 # Security audit + known performance issues
│   ├── features/                 # Feature specs (GamePage, DataStructures)
│   ├── discussions/              # Security discussions (CSRF, idempotency, etc.)
│   └── issues/                   # 45 documented GitHub issues (#48–#95)
│
├── graphify-out/                 # Auto-extracted knowledge graph
│   ├── GRAPH_REPORT.md           # Full audit (1,297 nodes, 2,238 edges, 108 communities)
│   ├── graph.html                # Interactive browser graph
│   ├── graph.json                # Raw graph data
│   └── .graphify_labels.json     # Human-readable community labels
│
├── .agents/skills/               # Project-local agent skills
├── proxy.ts                      # Clerk middleware (route protection)
├── next.config.ts                # Supabase hostname, next/image qualities [75, 85]
├── instrumentation-client.ts     # PostHog client init
├── package.json
└── README.md                     # ← you are here
```

---

## UI design system

Defined in [`app/globals.css`](app/globals.css) via Tailwind v4 `@theme`. Hybrid pattern: **CSS Modules for structure + Tailwind utilities for variants**, composed through `cn()` from `lib/utils.ts`.

### Theme tokens

| Category | Tokens | Values |
|----------|--------|--------|
| **Charcoal base** | `--color-charcoal-950` → `--color-charcoal-850` | Deepest bg (`#1a1510`) → elevated surface (`#2e2820`) |
| **Slate / Stone** | `--color-slate-800` → `--color-slate-500`, `--color-stone-dust-400/300/200` | Structural borders, muted stone tones |
| **Torchlight accent** | `--color-torch-600` → `--color-torch-200` | Dark ember (`#a67c52`) → bright torch (`#f0cba8`); `--color-accent` = `--color-torch-400` |
| **Gold (legendary)** | `--color-gold-600` → `--color-gold-300` | `#9a7f3f` → `#ddb968` |
| **Blood (danger)** | `--color-blood-600` → `--color-blood-400` | `#6b1f14` → `#ab3d2a` |
| **Runic-silver text** | `--color-text-primary/-secondary/-muted` | `#e8e6e0` / `#c0bbb2` / `#8a8278` |
| **Semantic** | `bg-base`, `bg-surface`, `bg-elevated`, `accent`, `border` | Mapped from palette |
| **Glass** | `.bg-glass`, `.bg-glass-torch` | Frosted backdrop with blur |
| **Glow** | `.glow-accent`, `.glow-torch`, `.glow-gold`, `.glow-blood` | Torch box-shadow glows |
| **Gradient text** | `.text-gradient`, `.text-gradient-accent`, `.text-gradient-gold`, `.text-gradient-blood` | CSS gradient fill |

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

**45 documented issues (#48–#95) · dependency-mapped · knowledge-graphed · fully documented in [`documentations/issues/`](documentations/issues/)** with: problem description, root cause, solution, code examples, dependency tracking, and verification checklists. These docs are kept as the historical record of how each problem was analyzed and resolved — they are **not** modified when the code catches up.

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

### Implemented in code (formerly-open issues now closed)

| # | Issue | Status |
|---|-------|--------|
| **80** | GamePage navigation | ✅ `app/game/[uuid]/page.tsx` + `game-detail.tsx` |
| **81** | Binary-search hotness cache | ✅ `utilities/hotnessCache.ts` (pako-gzip, parallel arrays) |
| **82** | Batch MongoDB fetch via Redis queue | ✅ `utilities/gameFetchPipeline.ts` |
| **84** | GamePage UI | ✅ `components/game/*` (GameHeader, CharacterTabs, MapList, ItemGrid) |
| **89/95** | Likes instant write + Zustand store | ✅ `stores/likes-store.ts` |
| **93/94** | Upstash migration + remove ioredis | ✅ `lib/queue.ts` (single Upstash client) |

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
| **Likes** | #89, #90, #91, #92, #93, #94, #95 | ✅ All closed |
| **GamePage** | #80, #81, #82, #84, #85 | ✅ All closed |

### Currently open (not implemented in code — see "What's unfinished")

- Audit logging (failed-auth, data mods, unusual access)
- WAF + request signing
- Penetration test
- Transactional guarantees across Postgres + MongoDB
- MongoDB schema-migration framework
- Monitoring / alerting

---

## What's unfinished

Honest accounting of what's NOT done yet. Updated 2026-08-17.

### 🟩 Now implemented (no longer open)

- **GamePage detail route** (`/game/[uuid]`) — server `page.tsx` (with `generateMetadata`) + client `game-detail.tsx`, tabs for characters/maps/items, instant preload via `useGamePreload()`.
- **Play screen** (`/play`, `/play/[sid]`) — `PlayScreen`, `PlayGate`, `ScenarioEntry` + scenario components.
- **AI server integration** — `lib/ai-server-client.ts`, `lib/playClient.ts`, `app/api/ai-server/[...path]/route.ts` relay to FastAPI (`AI_SERVER_URL`).
- **Likes store** — `stores/likes-store.ts` (zustand + persist, optimistic + revert) and **hotness cache** — `utilities/hotnessCache.ts` (binary-search sorted array, pako-gzip, promotion threshold).

### 🟧 Production checklist (incomplete)

| # | Item | Status |
|---|------|--------|
| 8 | Audit logging (failed-auth, data mods, unusual access) | 🔲 Not started |
| 9 | WAF + request signing | 🔲 Not started |
| 10 | Penetration test | 🔲 Not started |

Items 1-7 are completed (CORS allow-list, size limits, security headers, rate limiting, JWT migration, etc.).

### 🟨 Known performance / data-integrity issues (not yet addressed in code)

From [`documentations/problems/`](documentations/problems/):

| Issue | Risk | Status |
|-------|------|--------|
| Cache stampede (multiple requests on miss) | High | Designed (locking), not implemented |
| N+1 MongoDB queries in loops | High | Mitigated by retry + batch pipeline |
| Memory exhaustion from unbounded cache | Medium | Hotness cache evicts via barrier, but general guard missing |
| Dual-DB sync race (PostgreSQL vs MongoDB) | High | No saga/transaction across the two stores |
| Cache/DB divergence on partial writes | Medium | TTL-based eventual consistency |
| No performance metrics / alerting | Medium | No monitoring implemented |
| Transactional guarantees across Postgres + MongoDB | High | Manual saga cleanup only |
| MongoDB schema-migration framework | Medium | Manual migration scripts required |
| No zero-downtime deployment strategy | Medium | Not implemented |

### 🟨 Security gaps not yet addressed

From [`documentations/problems/01-SECURITY_VULNERABILITIES.md`](documentations/problems/01-SECURITY_VULNERABILITIES.md) and the knowledge-graph audit:

- **No authorization layer** — all authenticated users treated equally; staff checks exist in Convex (`requireStaff`) but not consistently enforced on REST routes.
- **`GET /api/drain` performs a state change** (CSRF-prone) and the internal drain relies on a header flag rather than S2S auth.
- **Idempotency keys not scoped to user** — a key is global in `idempotency:<key>`.
- **Rate limiter bypass** — depends on `x-forwarded-for`, which can be spoofed.
- **No audit logging** of auth failures or data mutations.

### 🟨 Knowledge graph blind spots

The auto-extracted graph ([`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md)) flagged **462 isolated nodes** with one or fewer connections (e.g. `.svg` assets, plugin package metadata). These are files, types, and utilities that may lack documentation or integration tracking. See the full report for the isolated node list.

---

## Security & known issues

### Security audit summary

From [`documentations/problems/01-SECURITY_VULNERABILITIES.md`](documentations/problems/01-SECURITY_VULNERABILITIES.md):

| Severity | Count | Examples | Status |
|----------|-------|----------|--------|
| 🔴 Critical | 4 | JWT secret exposure, missing CORS, unbounded request size, missing security headers | ✅ Mitigated |
| 🟠 High | 5 | No rate limiting (fixed), missing token expiration (safe), no input validation (fixed) | ✅ Mostly fixed |
| 🟡 Medium | 4 | Information disclosure, no audit logging, no API versioning | 🔲 Audit log open |
| 🟢 Low | 2 | Verbose error messages, no HTTPS enforcement (Vercel handles) | ✅ Acceptable risk |

### Auth model (current)

- **Server:** Clerk `auth()` in `lib/jwt-validate.ts` → `validateJWTMiddleware(request)` returns `{ userId }` or a 401 `NextResponse`. No `CLERK_JWT_SECRET` or JWT-template validation is performed.
- **API boundary:** every route is wrapped in `tryApiRoute()` with `classifyError()` for unified error classification.
- **Convex:** `requireAuth()` / `requireStaff()` in `convex/authHelpers.ts` provide staff RBAC for realtime functions.
- **No `*_JWT_SECRET` env vars** are required or referenced.

### Known performance issues

From [`documentations/problems/02-KNOWN_ISSUES.md`](documentations/problems/02-KNOWN_ISSUES.md):

1. **N+1 Redis queries** — individual `GET` per game ID in list endpoint (mitigated by `redis.mget`)
2. **Cache stampede** — multiple requests hit DB on cache miss (solution designed, not implemented)
3. **Memory exhaustion** — unbounded cache growth (hotness cache has a barrier; general guard missing)
4. **Slow MongoDB queries** — no indexes on `id` field (documented)
5. **PostgreSQL connection exhaustion** — pool size configured but no monitoring
6. **Dual-DB sync** — PostgreSQL + MongoDB can diverge on partial failure
7. **Cache/DB divergence** — stale data served after write

---

## Knowledge graph

The codebase is auto-extracted into a navigable knowledge graph via [graphify](https://github.com/anomalyco/graphify):

| Metric | Value |
|--------|-------|
| Nodes | 1,297 |
| Edges | 2,238 |
| Communities | 108 (81 shown, 27 thin omitted) |
| Extraction confidence | 94% extracted, 6% inferred |
| Import cycles | None detected |

### God nodes (most-connected abstractions)

| Node | Connections | What |
|------|-------------|------|
| `classifyError()` | 62 | Unified error classification across all lib/utilities modules |
| `cn()` | 31 | Class-merge helper used throughout the UI |
| `retry()` | 30 | DB/Redis resilience wrapper |
| `tryApiRoute()` | 22 | Request boundary wrapper for API routes |
| `validateJWTMiddleware()` | 20 | Auth gate for API routes |
| `Known Issues & Performance Problems` | 17 | Central problems doc reference |
| `compilerOptions` | 16 | TypeScript config |
| `UI/UX & Design System Issues` | 16 | Central design-system issues doc |
| `redisWithExponentialRetry()` | 15 | Redis retry wrapper |
| `@upstash/redis SDK` | 15 | Cache + queue client |

### Community hubs (auto-discovered, top cohesion)

| Community | Cohesion | Theme |
|-----------|----------|-------|
| Convex Migration Helper Config | 1.00 | Migration helper skill config |
| Proxy Relay Route | 0.70 | `/api/ai-server` relay to FastAPI |
| API Proxy Route | 0.60 | AI-server proxy verbs |
| Security & Auth Issues | 0.48 | Auth gaps, CSRF, idempotency scoping |
| PostHog Analytics Setup | 0.52 | PostHog integration |
| Clerk Staff Authorization | 0.31 | `requireStaff()` RBAC |
| Cache Warmup & Hotness Cache | 0.16 | `cache-warmup.ts` + `hotnessCache.ts` |
| Play Screen & Scenarios | 0.14 | `PlayScreen`, `ScenarioEntry` |
| Game Detail Page Components | 0.11 | `GameHeader`, `CharacterTabs`, `MapList`, `ItemGrid` |
| Game Fetch & Auth Hooks | 0.06 | Read path hooks + auth |

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
│   ├── 02-KNOWN_ISSUES.md             # N+1, cache stampede, dual-DB sync, race conditions
│   └── 05-UI_UX_DESIGN_ISSUES.md      # Design-system gaps
│
├── features/                    # Feature specs
│   ├── GamePage/
│   │   ├── GamePage.md          # Full spec
│   │   ├── GamePage_Integration_Guide.md
│   │   ├── GAMEPAGE_QUICKSTART.md
│   │   ├── GAMEPAGE_README.md
│   │   └── GAMEPAGE_SUMMARY.md
│   └── DataStructures.md
│
├── discussions/                 # Security discussions
│   └── security/                # CSRF, idempotency, JWT, authorization, rate limiting
│
└── issues/                      # 45 documented GitHub issues (#48–#95)
    ├── README.md                # Full index with dependency graph + status tracker
    └── *.md                     # Individual issues
```

---

## Environment variables

```env
# Convex (opt-in realtime — not on primary write path)
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

# Upstash Redis (cache + queue + idempotency)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# AI server (FastAPI relay target for /api/ai-server)
AI_SERVER_URL=http://127.0.0.1:8000

# App URL (used for internal drain self-calls)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Analytics
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

> ⚠️ **Never commit `.env` or `.env.local`.** Keep secrets in a managed store (Vercel Env / GitHub Secrets). No `*_JWT_SECRET` variables are required — Clerk issues the JWTs.

---

## Development commands

```bash
npm run dev          # Start Next.js dev server (Turbopack, hot reload)
npm run build        # Production build with type-checking
npm run start        # Run production server
npm run lint         # ESLint across all source files

# Convex (optional, requires separate terminal)
npx convex dev       # Local Convex deployment with hot reload
npx convex dashboard # Open Convex web dashboard
npx convex deploy    # Deploy Convex functions to production
```

### Quick start

```bash
npm install
# Create .env.local with the variables above
npx convex dev       # Terminal 1 (optional realtime)
npm run dev          # Terminal 2
```

Open http://localhost:3000. Clerk handles sign-in, the wizard walks you through creating your first game, the GamePage and Play screens are live, and PostHog records the visit.

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
| [`posthog-setup-report.md`](legacy-documentations/posthog-setup-report.md) | PostHog setup report (legacy) |
| [`AiServerArchitecture.md`](legacy-documentations/AiServerArchitecture.md) | AI server architecture notes (legacy) |
| [`LOOPS.md`](legacy-documentations/LOOPS.md) | Development loop notes (legacy) |
| [`convex/_generated/ai/guidelines.md`](convex/_generated/ai/guidelines.md) | **Always read first** for Convex code |

### Knowledge graph

| File | What |
|------|------|
| [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md) | Full audit (1,297 nodes, 108 communities) |
| [`graphify-out/graph.html`](graphify-out/graph.html) | Interactive graph in browser |
| [`graphify-out/graph.json`](graphify-out/graph.json) | Raw graph data (2,238 edges) |

### Authoritative external docs

[Next.js 16](https://nextjs.org/docs) · [React 19](https://react.dev) · [Tailwind v4](https://tailwindcss.com/docs) · [Convex](https://docs.convex.dev) · [Clerk Next.js](https://clerk.com/docs/quickstarts/nextjs) · [Neon](https://neon.tech/docs) · [Mongoose](https://mongoosejs.com/docs) · [Upstash Redis](https://upstash.com/docs) · [Supabase Storage](https://supabase.com/docs/guides/storage) · [PostHog JS](https://posthog.com/docs/libraries/js) · [Zod](https://zod.dev) · [Bottleneck](https://github.com/SGrondin/bottleneck) · [Radix UI](https://www.radix-ui.com) · [shadcn/ui](https://ui.shadcn.com) · [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
