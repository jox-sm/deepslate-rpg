# Data Flow Documentation

## Complete Game Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                         GAME LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Creation
├─ User fills game form
├─ Frontend validates input
├─ Attach JWT token and idempotency key
└─ POST /api/push/pushGames

Phase 2: Queue Processing
├─ API validates JWT and idempotency
├─ Push job to Redis queue
├─ Trigger background worker if needed
└─ Respond to user immediately (async)

Phase 3: Database Insertion
├─ Worker pulls from Redis queue
├─ Insert into PostgreSQL
├─ Insert into MongoDB
├─ Create Convex record
└─ Warm Redis cache

Phase 4: Availability
├─ Game appears in /api/games list
├─ Can be fetched via /api/games/[id]
├─ Visible in real-time via Convex
└─ Cached in Redis for fast retrieval

Phase 5: Updates
├─ User modifies game
├─ Same flow as creation
├─ Existing records updated
├─ Cache invalidated
└─ New cached version created

Phase 6: Deletion (if implemented)
├─ Mark as deleted in PostgreSQL
├─ Remove from MongoDB
├─ Invalidate cache
└─ Soft delete (maintain history)
```

## API Request/Response Flow

### GET /api/games (List Games)

**Request:**
```http
GET /api/games?page=1&limit=10
Authorization: Bearer <JWT_TOKEN>
```

**Processing:**
```
1. Validate JWT token
   ├─ Extract from Authorization header
   ├─ Verify signature
   └─ Decode claims
   
2. Parse query parameters
   ├─ page: 1 (current page)
   └─ limit: 10 (items per page)
   
3. Calculate pagination
   ├─ offset = (page - 1) * limit
   └─ offset = 0
   
4. Check Redis cache (games:list)
   ├─ If HIT: Return cached data
   └─ If MISS: Query databases
   
5. Query PostgreSQL
   ├─ SELECT * FROM games
   ├─ ORDER BY created_at DESC
   ├─ LIMIT 10 OFFSET 0
   └─ COUNT(*) for total
   
6. For each game, retrieve from MongoDB
   ├─ Get characters, maps, items
   └─ Combine with PostgreSQL data
   
7. Backfill cache
   ├─ Store in games:list
   ├─ Set TTL to 1 hour
   └─ Don't block response
   
8. Return response
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "Game 1",
      "description": "...",
      "image": "url",
      "tags": ["tag1", "tag2"],
      "likesCount": 100,
      "characters": [...],
      "maps": [...],
      "items": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasMore": true,
    "source": "redis"
  }
}
```

### GET /api/games/[id] (Get Single Game)

**Request:**
```http
GET /api/games/abc-123-def
Authorization: Bearer <JWT_TOKEN>
```

**Processing:**
```
1. Validate JWT token
   
2. Extract game ID
   ├─ Validate format (UUID)
   └─ Sanitize input
   
3. Check Redis cache (game:{id})
   ├─ If HIT: Return immediately
   └─ If MISS: Query databases
   
4. Query PostgreSQL
   ├─ SELECT * FROM games WHERE id = ?
   └─ Get base game data
   
5. Query MongoDB
   ├─ SELECT FROM games WHERE id = ?
   └─ Get extended data (characters, maps, items)
   
6. Combine results
   ├─ Merge PostgreSQL + MongoDB
   └─ Create unified game object
   
7. Backfill cache
   ├─ Store in game:{id}
   ├─ Set TTL to 2 hours
   └─ Async operation
   
8. Return response
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc-123-def",
    "name": "Game Name",
    "description": "...",
    "image": "...",
    "tags": ["tag1"],
    "likesCount": 50,
    "created_at": "2026-05-30T12:00:00Z",
    "updated_at": "2026-05-30T12:00:00Z",
    "characters": [
      {
        "id": "char-1",
        "gameId": "abc-123-def",
        "name": "Hero",
        "description": "...",
        "image": "..."
      }
    ],
    "maps": [...],
    "items": [...]
  }
}
```

### POST /api/push/pushGames (Create Game)

**Request:**
```http
POST /api/push/pushGames
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "idempotencyKey": "unique-key-123",
  "name": "New Game",
  "description": "Description",
  "image": "image-url",
  "tags": ["tag1", "tag2"],
  "characters": [...],
  "maps": [...],
  "items": [...]
}
```

**Processing:**
```
1. Validate JWT token
   ├─ Extract and verify JWT
   ├─ Decode claims
   └─ Check expiration
   
2. Validate idempotency key
   ├─ Check if already processed
   ├─ If YES: Return cached response
   └─ If NO: Store and proceed
   
3. Validate request data
   ├─ Required fields: name, description
   ├─ Optional fields: image, tags, etc.
   └─ Validate data types
   
4. Push to Redis queue
   ├─ Create job object
   ├─ Add to games:queue
   └─ Store with metadata
   
5. Check if worker running
   ├─ If YES: Job will be processed soon
   └─ If NO: Trigger worker process
   
6. Return response immediately
   ├─ Don't wait for processing
   ├─ Include job ID
   └─ Include idempotency key
   
7. Background processing
   ├─ Worker pulls from queue
   ├─ Insert into PostgreSQL
   ├─ Insert into MongoDB
   ├─ Create Convex record
   ├─ Warm cache
   └─ Trigger WebSocket update
```

**Response (Immediate):**
```json
{
  "success": true,
  "message": "Game added to queue",
  "data": {
    "id": "uuid-generated",
    "status": "queued"
  },
  "idempotencyKey": "unique-key-123",
  "cached": false
}
```

### POST /api/convertUrl (Upload Image)

**Request:**
```http
POST /api/convertUrl
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

[binary image data]
```

**Processing:**
```
1. Validate JWT token
   ├─ Extract from header
   ├─ Verify signature
   └─ Decode claims
   
2. Validate idempotency
   ├─ Check if already processed
   ├─ If YES: Return cached URL
   └─ If NO: Proceed
   
3. Parse request body
   ├─ Convert blob to buffer
   ├─ Validate file size
   └─ Validate file type
   
4. Get Clerk auth token
   ├─ Call auth().getToken()
   ├─ Specify template: 'supabase'
   └─ Receive Clerk JWT
   
5. Create authenticated Supabase client
   ├─ Pass Clerk JWT in Authorization header
   ├─ Supabase validates JWT
   └─ Establish authenticated session
   
6. Upload to Supabase Storage
   ├─ Convert image to webp format
   ├─ Generate unique filename
   ├─ Upload with authenticated client
   └─ Get public URL
   
7. Cache URL with idempotency key
   ├─ Store URL in cache
   └─ Set TTL (e.g., 24 hours)
   
8. Return image URL
```

**Response:**
```json
{
  "url": "https://supabase.../images/abc-123.webp",
  "idempotencyKey": "unique-key-456",
  "cached": false
}
```

## Inter-Service Communication

### Frontend → API Routes
```
HTTP REST
├─ Method: GET, POST
├─ Auth: JWT in Authorization header
├─ Format: JSON
└─ Response: JSON with status codes
```

### API Routes → Redis
```
TCP Connection (ioredis)
├─ Command: RPUSH (queue), GET/SET (cache)
├─ Auth: Connection URL with password
└─ Format: Binary protocol
```

### API Routes → PostgreSQL
```
TCP Connection (Neon)
├─ Query: SQL via pg library
├─ Auth: Connection string with credentials
└─ Format: Binary protocol
```

### API Routes → MongoDB
```
TCP Connection (Mongoose)
├─ Query: MongoDB operations
├─ Auth: Connection string with credentials
└─ Format: Binary BSON
```

### API Routes → Supabase
```
HTTPS REST
├─ Auth: JWT in Authorization header
├─ Format: Multipart form-data (images)
└─ Response: JSON
```

### Frontend ← Convex
```
WebSocket (Real-time)
├─ Auth: JWT
├─ Format: JSON
└─ Bidirectional: Subscriptions + updates
```

## Error Flow

### Validation Error
```
Request arrives at API
   ↓
JWT validation fails
   ↓
Return 401 with error message
   ├─ "Missing authorization token"
   ├─ "Invalid JWT: jwt malformed"
   └─ "Invalid JWT: jwt expired"
   ↓
Client receives error
   ├─ Redirects to login if needed
   ├─ Shows error message
   └─ Clears stored JWT
```

### Idempotency Error
```
Request arrives at API
   ↓
Check if idempotencyKey already processed
   ↓
If YES: Return cached response from previous attempt
   ├─ Same data
   ├─ Same status code
   └─ Prevent duplicate operations
```

### Database Error
```
Database operation fails
   ↓
Background worker catches error
   ├─ Log error details
   ├─ Retry with backoff
   └─ After max retries: move to error queue
   ↓
Job remains in queue
   ├─ Can be manually retried
   ├─ Prevents data loss
   └─ Admin can investigate
```

### Cache Error
```
Redis operation fails
   ↓
Error caught and logged
   ↓
Continue without cache (fallback to database)
   ├─ Response slower
   ├─ Database is authoritative
   └─ No data loss
```

## State Transitions

### Game State
```
CREATED (in queue)
   ↓
PROCESSING (worker active)
   ↓
STORED (in all databases)
   ↓
CACHED (in Redis)
   ↓
AVAILABLE (ready for retrieval)
   ↓
UPDATED (on modification)
   ↓
AVAILABLE (again)
```

### Request State
```
NEW_REQUEST
   ↓
JWT_VALIDATED
   ↓
IDEMPOTENCY_CHECKED
   ↓
DATA_RETRIEVED or QUEUED
   ↓
RESPONSE_SENT
   ↓
PROCESSING_COMPLETE (async)
```
