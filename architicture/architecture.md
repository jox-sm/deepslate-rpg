# Deepslate Dungeons — Architecture Document

## Overview

A Next.js 16 (App Router) / React 19 application for a D&D RPG game creation platform. Users fill a multi-step wizard form (characters, maps, items) and submit game data that flows through a multi-database pipeline (Redis → PostgreSQL → MongoDB) with Supabase image hosting, Clerk authentication with JWT integration, and PostHog analytics.

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
| Auth | Clerk (via `@clerk/nextjs`) | Authentication + JWT generation for external services |
| Real-time | Convex (scaffolded) | Ready for future real-time features |
| Tooling | eslint-config-next, Turbopack file cache, React Compiler | Lint, dev speed, optimization |

---

## Authentication Architecture

### Overview

We use **Clerk** as the primary authentication provider. Clerk handles user sign-up, sign-in, session management, and JWT generation for external services (Supabase, Neon, MongoDB).

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     CLERK (Auth Provider)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  User Auth   │  │  Session    │  │  JWT Templates      │ │
│  │  (Sign in)   │  │  Management │  │  (supabase, neon,   │ │
│  │              │  │              │  │   mongodb)           │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    JWT FLOW                                  │
│  1. User signs in to Clerk                                  │
│  2. Clerk creates session token                            │
│  3. getToken({ template: 'supabase' }) generates JWT       │
│  4. JWT is passed in Authorization header to service        │
│  5. Service validates JWT using Clerk's public key          │
└─────────────────────────────────────────────────────────────┘
```

### JWT Templates

We create separate JWT templates in Clerk for each external service:

#### supabase (Active)
```json
{
  "app_metadata": {},
  "aud": "authenticated",
  "email": "{{user.primary_email_address}}",
  "role": "authenticated",
  "sub": "{{user.id}}",
  "user_metadata": {}
}
```
- Algorithm: RS256 (Clerk default)
- Signing: Clerk's private key
- Verification: Supabase fetches Clerk's public JWKS endpoint

#### neon (Ready to configure)
```json
{
  "aud": "neon",
  "email": "{{user.primary_email_address}}",
  "role": "authenticated",
  "sub": "{{user.id}}"
}
```

#### mongodb (Ready to configure)
```json
{
  "aud": "mongodb",
  "email": "{{user.primary_email_address}}",
  "role": "authenticated",
  "sub": "{{user.id}}"
}
```

### RS256 vs HS256

We use **RS256** (asymmetric) instead of HS256 (symmetric):

| | RS256 (Our Choice) | HS256 |
|---|---------------------|-------|
| **Keys** | 2 (private + public) | 1 (shared secret) |
| **Signing** | Clerk's private key | Shared secret |
| **Verification** | Clerk's public JWKS endpoint | Same shared secret |
| **Security** | Better (no shared secret) | Good |
| **Setup** | Just add Clerk domain to Supabase | Paste JWT secret in Clerk |

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User visits protected route                             │
│  2. proxy.ts (Clerk middleware) intercepts                  │
│  3. auth.protect() checks session                          │
│  4. If unauthenticated → redirect to login                 │
│  5. If authenticated → continue to route                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `proxy.ts` | Clerk middleware for route protection |
| `lib/auth.ts` | Unified auth utility (Supabase, Neon, MongoDB) |
| `hooks/useAuth.ts` | Client-side hook for authenticated access |
| `app/convex-client-provider.tsx` | Convex + Clerk integration |
| `convex/auth.config.ts` | Convex auth configuration |

### Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (for JWT validation)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

---

## Project Structure

```
/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/
│   │   ├── games/          # GET /api/games (paginated) + /api/games/[id]
│   │   ├── push/           # POST /api/push (game + likes queues)
│   │   │   └── pushGames/  # POST /api/push/pushGames (→ MongoDB queue)
│   │   ├── convertUrl/     # POST image upload + game image conversion
│   │   │   └── ConvertGameImages/  # POST batch image conversion
│   │   └── test-supabase-auth/     # GET test JWT integration
│   ├── inventory/          # Game creation form page
│   ├── profile/            # Placeholder
│   ├── settings/           # Placeholder
│   ├── layout.tsx          # Root layout (fonts, sidebar, structure)
│   ├── page.tsx            # Home (game catalog with infinite scroll)
│   ├── globals.css         # Global reset & dark theme
│   ├── auth-gate.tsx       # Convex auth gate (Authenticated/Unauthenticated)
│   └── convex-client-provider.tsx  # Convex + Clerk provider
├── proxy.ts                # Clerk middleware (route protection)
├── types/                  # TypeScript type definitions
│   ├── cards.ts            # CardProps, GameCardProps, API response types
│   ├── db.ts               # Likes type
│   ├── form.ts             # Wizard types (CharacterData, MapData, ItemData, etc.)
│   ├── gameForm.ts         # DB variants + USE_GAMES_FORM return type
│   └── images.ts           # UploadProgress, UploadOptions, ImageUploadOptions
├── db/                     # PostgreSQL schema + client
│   ├── schema.sql          # CREATE TABLE games, indexes
│   ├── client.ts           # Neon SQL client
│   └── migrate.ts          # Schema migration runner
├── models/                 # MongoDB/Mongoose schemas
│   └── games/mongodb/
│       ├── client.ts       # Mongoose connection
│       └── schema.ts       # Character/Map/Item subdocs + Game schema
├── lib/                    # Core utilities & services
│   ├── auth.ts             # Unified auth (Supabase, Neon, MongoDB JWT)
│   ├── db.ts               # PostgreSQL query functions (CRUD, pagination, batch)
│   ├── queue.ts            # Redis client singleton (ioredis)
│   ├── cache-warmup.ts     # Redis caching (warmup, get/set cached games, 24h TTL)
│   ├── retry.ts            # Retry wrapper (3 attempts, 500ms delay)
│   ├── supabase.ts         # Supabase client (anonymous key)
│   ├── storage.ts          # Image upload → Supabase (WebP via sharp)
│   ├── GamesInsert.ts      # MongoDB batch processor from Redis queue
│   ├── gamesFormValidation.ts  # Field-level validators for wizard steps
│   └── utils.ts            # cn() tailwind class merger
├── hooks/                  # Custom React hooks
│   ├── form.ts             # useGameForm (basic game info state)
│   ├── gameForm.ts         # useGamesForm (wizard multi-step state)
│   ├── useFormState.ts     # Shared form state primitive
│   └── useAuth.ts          # Client-side authenticated access hook
├── utilities/              # Standalone helper functions
│   ├── db.ts               # Redis queue push/pull for games & likes
│   ├── insertGame.ts       # MongoDB-specific Redis queue operations
│   ├── pull.ts             # Legacy queue processor (Redis → PG batch)
│   ├── utils.ts            # Data prep (UUID v7, timestamps, API fetch)
│   ├── FormUtils.ts        # text validation, fileToBase64 conversion
│   ├── imagesUtils.ts      # sharp WebP conversion, progress tracking
│   ├── insertGameImages.ts # Base64 → Supabase URL pipeline
│   └── sleep.ts            # Shared sleep utility
├── components/             # React components
│   ├── adventures/cards/   # CardsGrid (infinite scroll), CardsLoad (batch), ProfileCard
│   ├── adventures/form/    # CreateForm (main form, 2-stage: info + wizard)
│   ├── adventures/cards/cards-grid-wrapper.tsx  # Server component wrapper
│   ├── background/         # Sidebar, Sbar (wrapper), ProfileMenu
│   └── authentication/     # Unauthenticated overlay
├── ui/                     # Reusable UI primitives
│   ├── FormUI/             # TextAreaField, tagsComponent, ImageUpload
│   ├── gamesFormUi/        # GamesFormWizard, CharactersStep, MapsStep, ItemsStep
│   └── primitives/         # Button, Input, Textarea
├── styles/                 # CSS Modules
│   ├── cards/              # Card, CardsGrid, CardsLoad styles
│   ├── forms/              # Form and wizard styles
│   ├── sidebar/            # Sidebar toggle & navigation styles
│   ├── layout/             # Layout structure styles
│   ├── background/         # Background gradient styles
│   ├── pages/              # Page-specific styles
│   ├── auth/               # Auth styles (orphaned)
│   └── authentication/     # Authentication styles
├── convex/                 # Convex backend (scaffolded)
│   ├── schema.ts           # Database schema (games, characters, maps, items)
│   ├── games.ts            # CRUD operations (not used by frontend yet)
│   ├── characters.ts       # CRUD operations
│   ├── maps.ts             # CRUD operations
│   ├── items.ts            # CRUD operations
│   └── auth.config.ts      # Clerk auth configuration
├── public/                 # Static assets (SVGs, images)
├── architicture/           # Architecture docs
└── .agents/                # Agent skills
    └── skills/             # Convex, Neon, PostHog skills
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
- **Game (MongoDB):** id (indexed), characters[], maps[], items[], status ("draft")

### Images
- **UploadProgress:** loaded, total, percentage
- **UploadOptions:** onProgress callback, signal (AbortSignal)
- **ImageUploadOptions:** cacheControl header

---

## Data Flow

### Game Creation Pipeline

```
User → CreateForm (name, description, tags, image)
  → Wizard: Characters step (add/remove/edit) → Maps step → Items step → Submit

1. POST /api/convertUrl       → main image → Supabase Storage → returns URL
   (uses Clerk JWT for authenticated upload)
2. fileToBase64()             → all component images → base64 strings
3. POST /api/push {type:game} → Redis queue "InsertGames"
   → pull.ts processes queue → Neon PostgreSQL INSERT
4. POST /api/convertUrl/ConvertGameImages  → base64 images → Supabase URLs
   (uses Clerk JWT for authenticated upload)
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
Client uploads image (base64/blob)
  → POST /api/convertUrl (with Clerk JWT)
  → convertComponentImagesJSON()
  → For each image:
    fetch(base64) → Buffer
    → sharp WebP (quality 80)
    → uploadImage() → Supabase Storage "deepslate-rpg" bucket
    → Replace with public URL
  → Returns authenticated URL
```

### JWT Authentication Pipeline

```
1. Client calls getToken({ template: 'supabase' })
   ↓
2. Clerk signs JWT with its private key (RS256)
   ↓
3. JWT is passed in Authorization header to Supabase
   ↓
4. Supabase fetches Clerk's public key from JWKS endpoint
   ↓
5. Supabase validates JWT signature
   ↓
6. RLS policies can use auth.jwt() ->> 'sub' to get user ID
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
├── ClerkProvider
│   └── ConvexProviderWithClerk
│       └── AuthGate
│           ├── AuthLoading → Spinner
│           ├── Unauthenticated → UnauthenticatedOverlay
│           └── Authenticated
│               ├── Sbar (Sidebar wrapper)
│               │   └── Sidebar (collapsible nav with PostHog tracking)
│               └── Children
│                   ├── Home Page (/)
│                   │   └── CardsGridWrapper (server component)
│                   │       └── CardsGrid (infinite scroll orchestrator)
│                   │           └── CardsLoad[] (batches of 6)
│                   │               └── ProfileCard[] (3 per row)
│                   └── Inventory Page (/inventory)
│                       └── CreateForm (2-stage creation form)
│                           └── GamesFormWizard (3-step: Characters → Maps → Items)
│                               ├── CharactersStep (character CRUD)
│                               ├── MapsStep (map CRUD)
│                               └── ItemsStep (item CRUD + submit)
```

---

## State Management

- **100% local state** — no Redux, Zustand, or Context
- `useGameForm` hook: manages basic game info (name, description, image, tags)
- `useGamesForm` hook: manages wizard multi-step state (current step, characters[], maps[], items[])
- `useFormState` hook: shared form primitive (extracted from duplicate hooks)
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
- Image upload fallback: if Supabase upload fails, keeps original base64 data

---

## External Services Summary

| Service | Integration Point | Status | Auth Method |
|---------|------------------|--------|-------------|
| Clerk | Authentication + JWT provider | Active | Primary auth |
| Convex | Real-time backend | Scaffolded | Clerk JWT |
| Neon PostgreSQL | `@neondatabase/serverless` SQL driver | Active | DATABASE_URL |
| MongoDB Atlas | Mongoose ODM | Active | MONGODB_URI |
| Redis (Upstash) | ioredis | Active | redisqueue |
| Supabase Storage | `@supabase/supabase-js` | Active | Clerk JWT (RS256) |
| PostHog | posthog-js | Active | NEXT_PUBLIC_POSTHOG_KEY |
| Vercel | Deployment target | Configured | - |

---

## Security

### JWT Integration
- Clerk signs JWTs with RS256 (private key)
- Services verify with Clerk's public JWKS endpoint
- No shared secrets between services
- Tokens have configurable lifetimes (default 60s)

### Route Protection
- `proxy.ts` middleware protects all routes except `/` and `/api/test-supabase-auth`
- `auth.protect()` ensures only authenticated users access protected routes
- Convex `AuthGate` provides client-side auth state

### Environment Variables
- `NEXT_PUBLIC_*` variables are client-safe (visible in browser)
- Regular variables are server-only (hidden from browser)
- Never put secrets in `NEXT_PUBLIC_*` variables

---

## Performance

### Caching
- Redis caching with 24h TTL reduces database queries
- Cache warmup on first request seeds top 100 games
- Cache-aside pattern with async backfill

### Image Optimization
- WebP format (25-35% smaller than JPEG)
- Sharp library for server-side conversion
- CDN delivery via Supabase Storage
- Configurable cache control headers

### Database
- Neon PostgreSQL serverless (scales to zero)
- MongoDB flexible schema for varying game structures
- Redis sub-millisecond latency for caching

---

## Development

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Known Issues

- TypeScript compiler runs out of memory (large codebase)
- ESLint has pre-existing warnings (unused vars, hook dependencies)
- Convex CRUD operations are scaffolded but not used by frontend
- Some CSS conflicts in layout styles (position: sticky on body)
- Redis queue has race condition potential (Date.now() collision)
- Object URL memory leak in imageComponent.tsx (fixed)

---

## Future Improvements

1. Complete Neon JWT integration
2. Complete MongoDB JWT integration
3. Add upload progress UI components
4. Implement sophisticated retry policies (exponential backoff)
5. Add comprehensive logging and metrics
6. Write tests for critical paths
7. Implement Convex real-time features
8. Add image metadata tracking (dimensions, file size)
9. Configure Supabase RLS policies for authenticated uploads

---

*Last updated: May 2026*