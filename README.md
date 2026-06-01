# Deepslate Dungeons

A D&D RPG game creation platform built with Next.js 16, React 19, and a multi-database architecture optimized for free tiers.

## What Is This?

This is a web app where users create D&D-style RPG games. They fill out a form with:
- Game name, description, tags, and cover image
- Characters (with images and descriptions)
- Maps (with images, sizes, and locations)
- Items (with images)

The app then stores this data across multiple databases, each chosen for its specific strength.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React 19)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  CreateForm  │  │ CardsGrid   │  │ Sidebar (Nav)       │ │
│  │  (Wizard)    │  │ (Infinite)  │  │ PostHog Analytics   │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘ │
└─────────┼────────────────┼───────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    API ROUTES (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ /api/push     │  │ /api/games   │  │ /api/convertUrl  │  │
│  │ (Redis Queue) │  │ (Read Data)  │  │ (Image Upload)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼──────────────────┼───────────────────┼─────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND SERVICES                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│  │  Redis  │  │  Neon   │  │ MongoDB │  │   Supabase   │  │
│  │ (Cache) │  │   PG    │  │         │  │   Storage    │  │
│  └─────────┘  └─────────┘  └─────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Services Used

| Service | Purpose | Why This One? |
|---------|---------|---------------|
| **Neon PostgreSQL** | Game catalog (name, description, tags, likes) | Best for relational queries, efficient indexing |
| **MongoDB** | Extended game details (characters, maps, items) | Flexible document storage for variable schemas |
| **Redis** | Caching (24h TTL) + job queues | Sub-millisecond latency, perfect for caching |
| **Supabase** | Image storage with CDN | Specialized for media, cost-effective for blobs |
| **Clerk** | Authentication + JWT provider | Better DX than Supabase Auth, social login |
| **Convex** | Real-time backend (scaffolded) | Ready for future real-time features |
| **PostHog** | Analytics | Event tracking, error capture |

## How It Works

### Game Creation Flow

```
1. User fills out CreateForm (name, description, tags, image)
   ↓
2. Wizard: Add Characters → Maps → Items
   ↓
3. Submit triggers:
   a. POST /api/convertUrl → Upload main image to Supabase → Get URL
   b. POST /api/push → Add game to Redis queue → Insert into PostgreSQL
   c. POST /api/convertUrl/ConvertGameImages → Upload all component images
   d. POST /api/push/pushGames → Add to MongoDB queue → Insert into MongoDB
```

### Game Reading Flow

```
GET /api/games?page=1&limit=10
   ↓
1. Check Redis cache (sorted set of game IDs)
   ↓
2. Cache HIT → Return cached games (fast!)
   ↓
3. Cache MISS → Query PostgreSQL → Return games
```

### Image Processing

```
Client uploads image (base64/blob)
   ↓
Convert to WebP (sharp, quality 80)
   ↓
Upload to Supabase Storage (deepslate-rpg bucket)
   ↓
Return public URL
```

## Key Files

### Authentication
- `proxy.ts` - Clerk middleware for route protection
- `lib/auth.ts` - Unified auth for Supabase, Neon, MongoDB
- `hooks/useAuth.ts` - Client-side authenticated access
- `convex/auth.config.ts` - Convex + Clerk config

### Database
- `lib/db.ts` - PostgreSQL queries (Neon)
- `models/games/mongodb/schema.ts` - MongoDB schema (Mongoose)
- `lib/queue.ts` - Redis client
- `lib/cache-warmup.ts` - Redis caching

### Storage
- `lib/storage.ts` - Supabase image upload
- `utilities/imagesUtils.ts` - WebP conversion, progress tracking

### API Routes
- `app/api/games/route.ts` - Read games (Redis → PostgreSQL)
- `app/api/push/route.ts` - Queue games/likes to Redis
- `app/api/push/pushGames/route.ts` - Queue to MongoDB
- `app/api/convertUrl/route.ts` - Upload images to Supabase

### Components
- `components/adventures/form/form.tsx` - Game creation form
- `components/adventures/cards/cards.tsx` - Game display cards
- `components/background/sidebar/sidebar.tsx` - Navigation

## Environment Variables

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SUPABASE_BUCKET_NAME=deepslate-rpg

# Neon PostgreSQL
DATABASE_URL=...

# MongoDB
MONGODB_URI=...

# Redis
redisqueue=...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=...
```

## JWT Integration

We use Clerk JWTs to authenticate with external services:

1. **Supabase** - Clerk signs JWT, Supabase validates with Clerk's public key
2. **Neon** - (Ready to configure)
3. **MongoDB** - (Ready to configure)

Each service gets its own JWT template in Clerk dashboard.

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Known Issues

- TypeScript compiler runs out of memory (large codebase)
- ESLint has pre-existing warnings (unused vars, hook dependencies)
- Convex CRUD operations are scaffolded but not used by frontend
- Some CSS conflicts in layout styles

## License

Private project - Deepslate Dungeons