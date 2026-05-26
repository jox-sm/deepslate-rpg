# Deepslate RPG — Architecture Document

## Overview

A Next.js 16 (App Router) / React 19 application for a D&D RPG game creation platform. Users fill a multi-step wizard form (characters, maps, items) and submit game data that flows through a multi-database pipeline (Redis → PostgreSQL → MongoDB) with Supabase image hosting and PostHog analytics.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) + React 19 | Server-side rendering, API routes, routing |
| Language | TypeScript (strict) | Type safety |
| Styling | Tailwind CSS v4 + CSS Modules | Utility-first + scoped component styles |
| UI Library | shadcn/ui (Radix Nova style) + Radix UI + Lucide icons | Reusable primitives |
| Primary DB | Neon PostgreSQL (via `@neondatabase/serverless`) | Game catalog (id, name, description, tags, likes, timestamps) |
| Rich DB | MongoDB (via Mongoose) | Extended game details (characters[], maps[], items[]) |
| Cache / Queue | Redis (via ioredis) | Game caching (24h TTL) + async job queues |
| Storage | Supabase Storage | Image hosting (WebP conversions via sharp) |
| Analytics | PostHog (via posthog-js) | Event tracking, error capture |
| Auth | Supabase Auth (partial, via `@supabase/ssr`) | Session middleware exists, flows incomplete |
| Tooling | eslint-config-next, Turbopack file cache, React Compiler | Lint, dev speed, optimization |

---

## Project Structure

```
/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/
│   │   ├── games/          # GET /api/games (paginated) + /api/games/[id]
│   │   ├── push/           # POST /api/push (game + likes queues)
│   │   │   └── pushGames/  # POST /api/push/pushGames (→ MongoDB queue)
│   │   └── convertUrl/     # POST image upload + game image conversion
│   ├── inventory/          # Game creation form page
│   ├── profile/            # Placeholder
│   ├── settings/           # Placeholder
│   ├── layout.tsx          # Root layout (fonts, sidebar, structure)
│   ├── page.tsx            # Home (game catalog with infinite scroll)
│   └── globals.css         # Global reset & dark theme
├── types/                  # TypeScript type definitions
│   ├── cards.ts            # CardProps, GameCardProps, API response types
│   ├── db.ts               # Likes type
│   ├── form.ts             # Wizard types (CharacterData, MapData, ItemData, etc.)
│   └── gameForm.ts         # DB variants + USE_GAMES_FORM return type
├── db/                     # PostgreSQL schema + client
│   ├── schema.sql          # CREATE TABLE games, indexes
│   ├── client.ts           # Neon SQL client
│   └── migrate.ts          # Schema migration runner
├── models/                 # MongoDB/Mongoose schemas
│   └── games/mongodb/
│       ├── client.ts       # Mongoose connection
│       └── schema.ts       # Character/Map/Item subdocs + Game schema
├── lib/                    # Core utilities & services
│   ├── db.ts               # PostgreSQL query functions (CRUD, pagination, batch)
│   ├── queue.ts            # Redis client singleton (ioredis)
│   ├── cache-warmup.ts     # Redis caching (warmup, get/set cached games, 24h TTL)
│   ├── retry.ts            # Retry wrapper (3 attempts, 500ms delay)
│   ├── supabase.ts         # Supabase client (anonymous key)
│   ├── storage.ts          # Image upload → Supabase (WebP via sharp)
│   ├── GamesInsert.ts      # MongoDB batch processor from Redis queue
│   ├── gamesFormValidation.ts  # Field-level validators for wizard steps
│   ├── useGamesForm.ts     # Re-export of wizard state hook
│   ├── middleware.ts       # Supabase auth session check (unregistered)
│   ├── server.ts           # Supabase server client factory
│   ├── client.ts           # Supabase browser client (commented out)
│   └── utils.ts            # cn() tailwind class merger
├── hooks/                  # Custom React hooks
│   ├── form.ts             # useGameForm (basic game info state)
│   └── gameForm.ts         # useGamesForm (wizard multi-step state)
├── utilities/              # Standalone helper functions
│   ├── db.ts               # Redis queue push/pull for games & likes
│   ├── insertGame.ts       # MongoDB-specific Redis queue operations
│   ├── pull.ts             # Legacy queue processor (Redis → PG batch)
│   ├── utils.ts            # Data prep (UUID v7, timestamps, API fetch)
│   ├── FormUtils.ts        # text validation, fileToBase64 conversion
│   ├── imagesUtils.ts      # sharp WebP conversion
│   └── insertGameImages.ts # Base64 → Supabase URL pipeline
├── components/             # React components
│   ├── adventures/cards/   # CardsGrid (infinite scroll), CardsLoad (batch), ProfileCard
│   ├── adventures/form/    # CreateForm (main form, 2-stage: info + wizard)
│   └── background/         # Sidebar, Sbar (wrapper), ProfileMenu
├── ui/                     # Reusable UI primitives
│   ├── FormUI/             # TextAreaField, tagsComponent, ImageUpload
│   └── gamesFormUi/        # GamesFormWizard, CharactersStep, MapsStep, ItemsStep
├── styles/                 # CSS Modules
│   ├── cards/              # Card, CardsGrid, CardsLoad styles
│   ├── forms/              # Form and wizard styles
│   └── sidebar/            # Sidebar toggle & navigation styles
├── public/                 # Static assets (SVGs, images)
├── architicture/           # Architecture docs
└── .agents/                # Neon Postgres skill
    └── .claude/            # PostHog integration skill + examples
```

---

## Key Types

### Card / Game
- **CardProps:** name, description, likes_count, tags[], image
- **GameCardProps:** CardProps + id (UUID v7), created_at, updated_at
- **ApiGameResponse:** id, name, description, image?, tags?, status?, timestamps

### Wizard Form
- **CharacterData:** id, name, description, image (File|null), imagePreview
- **MapData:** id, nameOfPlace, image, imagePreview, sizeOfPlace, placesAtMap
- **ItemData:** id, name, image, imagePreview
- **GamesFormData:** id, characters[], maps[], items[]
- **GamesFormDataDB:** Omit image/imagePreview, replace with string (base64 or URL)

### Database
- **Games (Neon PG):** id (UUID PK), name, likes_count, description, image, tags[], timestamps
- **Game (MongoDB):** id (indexed), characters[ {id, name, description, image} ], maps[ {id, nameOfPlace, sizeOfPlace, placesAtMap, image} ], items[ {id, name, image} ], status ("draft")

---

## Data Flow

### Game Creation Pipeline

```
User → CreateForm (name, description, tags, image)
  → Wizard: Characters step (add/remove/edit) → Maps step → Items step → Submit

1. POST /api/convertUrl       → main image → Supabase Storage → returns URL
2. fileToBase64()             → all component images → base64 strings
3. POST /api/push {type:game} → Redis queue "InsertGames"
   → pull.ts processes queue → Neon PostgreSQL INSERT
4. POST /api/convertUrl/ConvertGameImages  → base64 images → Supabase URLs
5. POST /api/push/pushGames   → Redis queue "InsertGamesmongodb"
   → processGamesQueue()      → MongoDB Game.insertMany()
```

### Game Reading Pipeline

```
GET /api/games?page=&limit=
  → ensureCachePrimed() if not yet primed
  → Redis: get cached game IDs from sorted set
  → If offset in cache range: return cached games (source: "redis")
  → Else fallback: PostgreSQL paginated query (source: "postgresql")

GET /api/games/:id
  → Redis: getGameFromCache (with retry, 3 attempts)
  → Cache HIT: return with X-Cache: HIT header
  → Cache MISS:
    1. PostgreSQL: getGameById()
    2. MongoDB: Game.findOne() → characters, maps, items
    3. Merge: { ...pgGame, characters, maps, items, status }
    4. Async backfill into Redis cache
    5. Return with X-Cache: MISS header
```

### Likes Pipeline

```
POST /api/push {type:like, data: {id, likesDelta}}
  → Redis queue "InsertLikes"
  → pull.ts processes → PostgreSQL UPDATE likes_count += 1
```

### Image Processing Pipeline

```
Client base64 string
  → POST /api/convertUrl/ConvertGameImages
  → convertComponentImagesJSON()
  → For each image:
    fetch(base64) → Buffer
    → sharp WebP (quality 80)
    → uploadImage() → Supabase Storage "deepslate-rpg" bucket
    → Replace with public URL
```

---

## Caching Strategy

- **Cache Key Pattern:** `game:{id}` (individual), `game:ids:all` (sorted set)
- **TTL:** 24 hours (86400 seconds)
- **Warmup:** On first request, fetches top 100 games from PG and seeds Redis
- **Pattern:** Cache-aside (check cache → fallback to DB → async backfill)
- **Cache Primed Flag:** `cache:primed:games` prevents repeated warmups

---

## Queue Architecture

### Queue 1: PostgreSQL Ingest (Redis keys: InsertGames, InsertLikes, load)
- Processed by `pull.ts` (legacy pattern)
- Batches inserts via PostgreSQL UNNEST
- Flow: rpush → sleep 850ms → rpop "load" → lrange queue → batch INSERT → del temp

### Queue 2: MongoDB Ingest (Redis keys: InsertGamesmongodb, InsertGamesmongodb:active)
- Processed by `processGamesQueue()` in `lib/GamesInsert.ts`
- Working flag prevents concurrent processing
- Flow: rpush → validate queue → set working flag → lrange → Game.insertMany → set idle

---

## Component Hierarchy

```
RootLayout
├── Sbar (Sidebar wrapper)
│   └── Sidebar (collapsible nav with PostHog tracking)
└── Children
    ├── Home Page (/)
    │   └── CardsGrid (infinite scroll orchestrator)
    │       └── CardsLoad[] (batches of 6)
    │           └── ProfileCard[] (3 per row)
    └── Inventory Page (/inventory)
        └── CreateForm (2-stage creation form)
            └── GamesFormWizard (3-step: Characters → Maps → Items)
                ├── CharactersStep (character CRUD)
                ├── MapsStep (map CRUD)
                └── ItemsStep (item CRUD + submit)
```

---

## State Management

- **100% local state** — no Redux, Zustand, or Context
- `useGameForm` hook: manages basic game info (name, description, image, tags)
- `useGamesForm` hook: manages wizard multi-step state (current step, characters[], maps[], items[])
- Props drilled through component trees at all levels

---

## PostHog Analytics Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `adventure_card_viewed` | ProfileCard mount | name, tags |
| `sidebar_toggled` | Sidebar toggle click | collapsed (boolean) |
| `navigation_item_clicked` | Nav link click | label |
| PostHog auto-capture | All | exceptions, pageviews |

PostHog reverse-proxied via Next.js rewrites (`/ingest/*` → `us.i.posthog.com/*`).

---

## Authentication (Incomplete)

- `lib/middleware.ts` defines `updateSession()` using Supabase SSR cookies
- Checks `supabase.auth.getClaims()`, redirects to `/auth/login` if unauthenticated
- **Not registered** as Next.js middleware — auth is not enforced
- `lib/server.ts` provides a server Supabase client factory
- `lib/client.ts` browser client is commented out
- No `/auth/*` route pages exist

---

## CSS & Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss` plugin
- **CSS Modules** for component-specific styles (cards, forms, sidebar)
- **shadcn/ui** configured as Radix Nova style, RSC enabled
- **Dark theme** via global CSS (radial gradients on `#0f0f0f` background)
- Utility: `cn()` via `tailwind-merge` + `clsx`
- Animations via `tw-animate-css`

---

## Error Handling

- `try/catch` with `console.error` in all API routes
- `retry()` utility: 3 attempts with 500ms fixed delay
- Form validation: real-time color-coded feedback (success / warning / error)
- SQL injection pattern detection in text validation
- Client-side error rendering in CardsLoad (visible error messages)
- MongoDB batch insert uses `{ ordered: false }` to continue despite individual failures

---

## External Services Summary

| Service | Integration Point | Status |
|---------|------------------|--------|
| Neon PostgreSQL | `@neondatabase/serverless` SQL driver | Active |
| MongoDB Atlas | Mongoose ODM | Active |
| Redis (Upstash) | ioredis | Active |
| Supabase Storage | `@supabase/supabase-js` | Active |
| Supabase Auth | `@supabase/ssr` | Partial |
| PostHog | posthog-js | Active |
| Vercel | Deployment target (inferred) | Configured |
