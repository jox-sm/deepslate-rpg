# Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 16)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  React Components (App Router)                              │  │
│  │  - UI Components (shadcn/ui, Radix UI)                     │  │
│  │  - Forms & Hooks                                            │  │
│  │  - PostHog Analytics                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ (REST API calls)
          ┌───────▼────────┐
          │  Auth Layer    │
          ├────────────────┤
          │ Clerk + JWT    │
          │ Supabase Auth  │
          │ Token Validation│
          └───────┬────────┘
                  │
        ┌─────────▼──────────┐
        │   API Routes       │
        │  (Next.js Routes)  │
        │                    │
        │ - /api/games       │
        │ - /api/push        │
        │ - /api/convertUrl  │
        │ - /api/games/[id]  │
        └────────┬───────────┘
                 │
        ┌────────┴────────────────────┐
        │                             │
        │                             │
    ┌───▼────────┐         ┌─────────▼────┐
    │   Redis    │         │   Database   │
    │  (Cache +  │         │   Backend    │
    │   Queue)   │         │              │
    └────────────┘         ├──────────────┤
                           │ PostgreSQL   │
                           │ (Neon)       │
                           │              │
                           ├──────────────┤
                           │ MongoDB      │
                           │              │
                           ├──────────────┤
                           │ Convex       │
                           │ (Realtime)   │
                           └──────────────┘
```

## Component Overview

### Frontend Layer
- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19.2.4 with shadcn/ui and Radix UI
- **Styling:** Tailwind CSS v4 with animations
- **Analytics:** PostHog for user tracking
- **Charts:** OGL for WebGL rendering

### Authentication Layer
- **Primary Auth:** Clerk with JWT tokens
- **Secondary Auth:** Supabase Auth integration
- **JWT Validation:** Custom middleware on all API routes
- **Token Templates:** Clerk, Neon, MongoDB support

### API Layer
- **Framework:** Next.js API Routes (App Router)
- **Middleware:** JWT validation, Idempotency checking
- **Response Format:** REST JSON
- **Error Handling:** Standardized error responses

### Cache Layer (Redis)
- **Primary Purpose:** Application cache + task queue
- **Cache Storage:** Games list, individual game objects
- **Queue Storage:** Background job processing
- **Connection:** ioredis library

### Database Layer

#### PostgreSQL (Neon - Primary)
- **Purpose:** Primary game data storage
- **Schema:** games table with indexed columns
- **Connection:** @neondatabase/serverless
- **Features:** Serverless scaling, automatic backups

#### MongoDB (Secondary)
- **Purpose:** Extended game data (characters, maps, items)
- **Connection:** Mongoose ODM
- **Schema:** Games collection with nested relationships
- **Purpose:** Complex object storage

#### Convex (Realtime)
- **Purpose:** Real-time subscriptions and backend functions
- **Features:** Optimistic updates, automatic caching
- **Schema:** games, characters, maps, items tables
- **Auth:** Convex auth integration

### Storage Layer (Supabase)
- **Purpose:** Image upload and storage
- **Service:** Supabase Storage (PostgreSQL-backed)
- **Authentication:** JWT tokens
- **Operations:** Upload, convert, retrieve images

## Data Flow Patterns

### Game Creation Flow
```
1. User submits game form (Frontend)
   ↓ (Form validation)
2. Frontend calls POST /api/push/pushGames
   ├─ Attaches: idempotencyKey, JWT token
   ├─ Payload: game data (name, description, images, etc.)
   ↓ (Network)
3. API Route Handler (/api/push/pushGames)
   ├─ Step 1: Validate JWT token
   ├─ Step 2: Check idempotency (prevent duplicates)
   ├─ Step 3: Validate game data
   ↓
4. Push to Redis Queue
   ├─ Enqueue job with game data
   ├─ Check if worker is running
   ↓
5. Background Worker Processes Queue
   ├─ Connect to PostgreSQL (Neon)
   ├─ Insert/Update game in PostgreSQL
   ├─ Connect to MongoDB
   ├─ Insert game details in MongoDB
   ├─ Warm Redis cache with new game
   ↓
6. Update Convex Backend
   ├─ Sync game to Convex real-time DB
   ├─ Trigger subscribers to update
   ↓
7. Response to User
   ├─ Idempotency cached response
   ├─ Include game ID and status
   ↓
8. Frontend Updates UI
   ├─ Show success message
   ├─ Refresh game list via WebSocket (Convex)
```

### Game Retrieval Flow
```
1. User requests game list or specific game (Frontend)
   ↓
2. Frontend calls GET /api/games or /api/games/[id]
   ├─ Includes: JWT token in header
   ↓ (Network)
3. API Route Handler
   ├─ Step 1: Validate JWT token
   ├─ Step 2: Extract query parameters
   ↓
4. Check Redis Cache (Layer 1 - Fastest)
   ├─ Key: games:list (for list) or game:{id} (for single)
   ├─ If HIT → Return cached data (< 1ms)
   │
   └─ If MISS → Proceed to database
       ↓
5. Query Databases (Layer 2 - Database)
   ├─ PostgreSQL Query
   │  ├─ SELECT from games table
   │  ├─ Apply pagination (offset/limit)
   │  ├─ Sort by likes_count or name
   │  └─ Execute with indexes
   │
   └─ MongoDB Query (for extended data)
      ├─ SELECT game by ID
      ├─ Load characters, maps, items
      └─ Combine with PostgreSQL data
       ↓
6. Combine Results
   ├─ Base data from PostgreSQL
   ├─ Extended data from MongoDB
   ├─ Calculate pagination metadata
   ↓
7. Backfill Cache (Layer 3 - Warming)
   ├─ Store in Redis for future requests
   ├─ Set TTL (time to live)
   ├─ Background operation (doesn't block response)
   ↓
8. Return Response
   ├─ Format JSON response
   ├─ Include pagination info
   ├─ Include cache source (Redis vs PostgreSQL)
   ↓
9. Frontend Receives Data
   ├─ Parse response
   ├─ Update component state
   ├─ Render UI
   ├─ Update Convex local state
```

### Image Upload Flow
```
1. User selects image file (Frontend)
   ↓
2. Frontend calls POST /api/convertUrl
   ├─ Payload: image blob
   ├─ Includes: idempotencyKey, JWT token
   ↓ (Network)
3. API Route Handler
   ├─ Step 1: Validate JWT token
   ├─ Step 2: Check idempotency
   ├─ Step 3: Create authenticated Supabase client
   ↓
4. Get Clerk Token
   ├─ Use auth().getToken() to get Clerk JWT
   ├─ Extract template-based token (supabase)
   ↓
5. Create Authenticated Supabase Client
   ├─ Pass JWT in Authorization header
   ├─ Supabase validates JWT
   ↓
6. Upload Image to Supabase Storage
   ├─ Convert blob to buffer
   ├─ Store as webp format
   ├─ Get public URL
   ↓
7. Return Image URL
   ├─ Send URL back to frontend
   ├─ Cache response with idempotency key
   ↓
8. Frontend Stores URL
   ├─ Use in game form
   ├─ Display preview to user
```

## Connection Matrix

| Component A | Component B | Protocol | Purpose | Auth |
|-------------|------------|----------|---------|------|
| Frontend | API Routes | HTTP REST | API calls | JWT |
| API Routes | Redis | TCP | Cache/Queue | Connection URL |
| API Routes | PostgreSQL | TCP | Read/Write games | Connection Pool |
| API Routes | MongoDB | TCP | Read/Write details | Mongoose |
| API Routes | Convex | TCP/WS | Realtime sync | Convex key |
| API Routes | Supabase | HTTPS | Image storage | JWT |
| Frontend | Convex | WebSocket | Real-time updates | JWT |
| Background Worker | Redis | TCP | Job processing | Connection URL |
| Background Worker | PostgreSQL | TCP | Batch inserts | Connection Pool |
| Background Worker | MongoDB | TCP | Batch inserts | Mongoose |

## Database Schema Relationships

```
PostgreSQL (Neon)
├── games
│   ├── id (UUID, PK)
│   ├── name
│   ├── description
│   ├── image
│   ├── tags (array)
│   ├── likes_count
│   ├── created_at
│   └── updated_at

MongoDB
├── games
│   ├── _id (ObjectId, PK)
│   ├── id (UUID, FK → PostgreSQL.games.id)
│   ├── characters (array of objects)
│   │   ├── id
│   │   ├── name
│   │   ├── description
│   │   └── image
│   ├── maps (array of objects)
│   │   ├── id
│   │   ├── name
│   │   ├── image
│   │   ├── sizeOfPlace
│   │   └── placesAtMap
│   ├── items (array of objects)
│   │   ├── id
│   │   ├── name
│   │   └── image
│   └── status

Convex
├── games
│   ├── _id
│   ├── name
│   ├── description
│   ├── image
│   ├── tags
│   └── likesCount
├── characters
│   ├── _id
│   ├── gameId (FK → games._id)
│   ├── name
│   ├── description
│   └── image
├── maps
│   ├── _id
│   ├── gameId (FK → games._id)
│   ├── name
│   ├── image
│   ├── sizeOfPlace
│   └── placesAtMap
└── items
    ├── _id
    ├── gameId (FK → games._id)
    ├── name
    └── image
```

## Caching Strategy

### Multi-Layer Cache

```
Layer 1: In-Memory Cache (Redis)
├── Games List Cache
│   ├── Key: games:list
│   ├── Value: Array of game objects (paginated)
│   ├── TTL: 1 hour
│   └── Invalidation: On new game or update
│
├── Individual Game Cache
│   ├── Key: game:{id}
│   ├── Value: Full game object with details
│   ├── TTL: 2 hours
│   └── Invalidation: On game update
│
└── Cache Metadata
    ├── Key: cache:ids
    ├── Value: Array of all cached game IDs
    ├── TTL: 1 hour
    └── Purpose: Fast pagination without DB query

Layer 2: Database Query Cache (Implicit)
├── PostgreSQL Connection Pooling
├── MongoDB Index Cache
└── Convex Automatic Caching
```

### Cache Invalidation Strategy

```
On Game Create:
└─ Add to games:list
└─ Invalidate cache:ids

On Game Update:
├─ Invalidate game:{id}
└─ Invalidate games:list

On Game Delete:
├─ Remove from game:{id}
├─ Invalidate games:list
└─ Invalidate cache:ids

On Like Count Change:
├─ Update game:{id}
└─ Invalidate games:list (re-sort by likes)
```

## Performance Characteristics

| Operation | Source | Latency | Notes |
|-----------|--------|---------|-------|
| List games (cache hit) | Redis | <1ms | Extremely fast |
| List games (cache miss) | PostgreSQL | 10-50ms | With pagination |
| Get game (cache hit) | Redis | <1ms | Full object |
| Get game (cache miss) | PostgreSQL + MongoDB | 20-100ms | Combines both DBs |
| Create game | Redis Queue → Worker | 100-500ms | Async processing |
| Upload image | Supabase | 500-2000ms | Depends on file size |

## Scalability Considerations

### Horizontal Scaling
- **Frontend:** Vercel auto-scaling
- **API Routes:** Serverless scaling on Vercel
- **Cache:** Redis cluster for distributed caching
- **PostgreSQL:** Neon auto-scaling
- **MongoDB:** MongoDB Atlas sharding
- **Realtime:** Convex multi-region replication

### Vertical Scaling
- Increase Redis memory for larger cache
- Upgrade PostgreSQL compute
- Increase MongoDB Atlas tier
- Increase API timeout limits

## Monitoring Points

1. **API Response Times:** Track per route
2. **Cache Hit Rate:** Monitor Redis efficiency
3. **Database Query Times:** Track slow queries
4. **Background Job Queue:** Monitor queue length
5. **Error Rates:** 4xx and 5xx response codes
6. **User Analytics:** PostHog event tracking
