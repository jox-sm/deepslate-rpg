# Known Issues & Performance Problems

## Performance Issues

### 1. N+1 Query Problem

**Issue:** Multiple database queries in loops

**Current Problem:**
```typescript
// In /api/games/[id]/route.ts
for (const id of pageIds) {
  const cachedGame = await getGameFromCache(id);
  if (cachedGame) {
    cacheResults.push(cachedGame);
  }
}
```

**Risk:** If 100 items miss cache, 100 separate queries executed

**Solution:**
```typescript
// Batch query
const ids = pageIds.filter(id => !cache.has(id));
const games = await db.query(
  'SELECT * FROM games WHERE id = ANY($1)',
  [ids]
);
```

---

### 2. Cache Stampede

**Issue:** Multiple requests query database simultaneously on cache miss

**Scenario:**
```
T1: User A requests game (cache miss)
T2: User B requests same game (cache miss)
T3: Both query database simultaneously
T4: Both backfill cache (duplicate work)
```

**Mitigation:**
```typescript
// Lock pattern
const lockKey = `lock:game:${id}`;
const lock = await redis.set(lockKey, '1', 'NX', 'EX', 5);

if (!lock) {
  // Wait for other request
  await redis.waitForKey(lockKey, { timeout: 5000 });
  return getGameFromCache(id);  // Now cached
}

try {
  const game = await getGameFromDb(id);
  await setGameInCache(id, game);
  return game;
} finally {
  await redis.del(lockKey);
}
```

---

### 3. Memory Exhaustion from Cache

**Issue:** Cache unbounded, can exceed memory

**Current:**
```typescript
// No TTL or max size
await redis.set(key, value);  // Could grow infinitely
```

**Solution:**
```typescript
// Set TTL
await redis.setex(key, 3600, value);  // 1 hour TTL

// Or use MAXMEMORY policy
redis.config('SET', 'maxmemory', '256mb');
redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
```

---

### 4. Slow MongoDB Queries

**Issue:** No indexes on frequently queried fields

**Problem:**
```javascript
// MongoDB scans entire collection
Game.findOne({ id: gameId });  // Full collection scan
```

**Solution:**
```javascript
// Add indexes
const schema = new Schema({ id: String });
schema.index({ id: 1 });  // Create index

// Or in MongoDB:
db.games.createIndex({ "id": 1 });
```

---

### 5. PostgreSQL Connection Exhaustion

**Issue:** Connection pool depleted under high load

**Mitigation:**
```typescript
// Configure pool size
const pool = new Pool({
  max: 20,  // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Monitor pool usage
console.log(`Pool: ${pool.totalCount} total, ${pool.idleCount} idle`);
```

---

## Data Consistency Issues

### 6. Dual Database Sync Problem

**Issue:** Game in PostgreSQL but not in MongoDB (or vice versa)

**Scenario:**
```
1. Insert into PostgreSQL succeeds
2. Insert into MongoDB fails
3. Data inconsistent
```

**Solution:**
```typescript
// Use transaction or saga pattern
async function createGame(data) {
  try {
    // 1. Insert into PostgreSQL
    const pgGame = await insertIntoPostgres(data);
    
    // 2. Insert into MongoDB
    const mongoGame = await insertIntoMongoDB({
      id: pgGame.id,
      ...data,
    });
    
    // 3. If both succeed, update cache
    await setGameInCache(pgGame.id, mergeData(pgGame, mongoGame));
    
    return pgGame;
  } catch (error) {
    // Cleanup on failure
    if (pgGame?.id) {
      await deleteFromPostgres(pgGame.id);
    }
    throw error;
  }
}
```

---

### 7. Cache/Database Divergence

**Issue:** Cached data differs from source database

**Cause:**
- Database updated without cache invalidation
- Cache TTL expired
- Backfill with old data

**Solution:**
```typescript
// Versioned cache entries
async function getGameWithValidation(id: string) {
  const cached = await redis.get(`game:${id}`);
  const cached_version = await redis.get(`game:${id}:version`);
  
  const db_game = await getGameFromDB(id);
  const db_version = db_game.updated_at.getTime();
  
  if (cached && cached_version === db_version) {
    return JSON.parse(cached);  // Trust cache
  }
  
  // Cache miss or stale
  await redis.setex(`game:${id}`, 3600, JSON.stringify(db_game));
  await redis.setex(`game:${id}:version`, 3600, db_version);
  
  return db_game;
}
```

---

## Concurrency Issues

### 8. Race Conditions in Updates

**Issue:** Two simultaneous updates cause data loss

**Scenario:**
```
T1: Read game (likes: 100)
T2: Read game (likes: 100)
T1: Update likes to 101, save
T2: Update likes to 101, save (lost increment from T1)
```

**Solution:**
```typescript
// Atomic operations
async function incrementLikes(gameId: string) {
  // Option 1: Database-level atomic update
  const result = await sql`
    UPDATE games 
    SET likes_count = likes_count + 1 
    WHERE id = ${gameId}
    RETURNING likes_count
  `;
  
  // Option 2: Compare-and-swap loop
  while (true) {
    const game = await getGame(gameId);
    const updated = await updateGame(
      gameId,
      game.likes_count + 1,
      game.likes_count  // Only update if not changed
    );
    if (updated) return;
  }
}
```

---

### 9. Background Worker Crashes

**Issue:** Worker crashes, queue jobs lost

**Current:**
```typescript
// Naive worker - crashes lose jobs
const job = await redis.lpop('games:queue');
await processGame(job);  // If crashes, job lost
```

**Solution:**
```typescript
// Reliable queue pattern
async function workerLoop() {
  while (true) {
    try {
      // Use BRPOPLPUSH for atomicity
      const job = await redis.brpoplpush(
        'games:queue',
        'games:processing',
        30  // 30 second timeout
      );
      
      if (!job) continue;
      
      try {
        await processGame(JSON.parse(job));
        // Remove from processing
        await redis.lrem('games:processing', 1, job);
      } catch (error) {
        console.error('Job failed:', error);
        // Move to dead-letter queue
        await redis.rpush('games:failed', job);
        await redis.lrem('games:processing', 1, job);
      }
    } catch (error) {
      console.error('Worker error:', error);
      await sleep(5000);  // Backoff
    }
  }
}
```

---

## Data Integrity Issues

### 10. Orphaned Records

**Issue:** Deleted game leaves records in MongoDB

**Problem:**
```sql
-- Game deleted from PostgreSQL
DELETE FROM games WHERE id = 'abc-123';

-- But MongoDB still has it
db.games.findOne({ id: 'abc-123' })  // Still exists!
```

**Solution:**
```typescript
// Implement cascading deletes
async function deleteGame(gameId: string) {
  try {
    // 1. Delete from PostgreSQL
    await sql`DELETE FROM games WHERE id = ${gameId}`;
    
    // 2. Delete from MongoDB
    await Game.deleteOne({ id: gameId });
    
    // 3. Invalidate cache
    await redis.del(`game:${gameId}`);
    await redis.del('games:list');  // Invalidate list cache
    
    // 4. Delete from Convex
    await deleteFromConvex(gameId);
  } catch (error) {
    console.error('Delete failed:', error);
    // Add to cleanup queue for manual intervention
    await redis.rpush('cleanup:games', gameId);
  }
}
```

---

### 11. Null/Undefined References

**Issue:** MongoDB documents reference non-existent games

**Risk:**
```javascript
// Character references non-existent game
{
  _id: ObjectId,
  gameId: "non-existent-id",
  name: "Hero"
}
```

**Solution:**
```typescript
// Add referential integrity checks
async function validateReferences() {
  // Find characters with missing game references
  const orphanedCharacters = await db.collection('characters')
    .find({
      gameId: { $nin: await getGameIds() }
    })
    .toArray();
  
  if (orphanedCharacters.length > 0) {
    console.warn(`Found ${orphanedCharacters.length} orphaned characters`);
    // Delete or reassign
    await db.collection('characters').deleteMany({
      gameId: { $nin: await getGameIds() }
    });
  }
}
```

---

## Monitoring & Observability

### 12. No Performance Metrics

**Issue:** Can't identify bottlenecks

**Solution:**
```typescript
// Add timing instrumentation
async function GET(request: NextRequest) {
  const startTime = performance.now();
  const metrics = {
    jwt_validation: 0,
    cache_lookup: 0,
    db_query: 0,
    response_format: 0,
  };
  
  // JWT validation
  let jwtStart = performance.now();
  const { payload, error } = await validateJWTMiddleware(request);
  metrics.jwt_validation = performance.now() - jwtStart;
  if (error) return error;
  
  // Cache lookup
  let cacheStart = performance.now();
  const cached = await getGameFromCache(id);
  metrics.cache_lookup = performance.now() - cacheStart;
  
  // DB query if needed
  if (!cached) {
    let dbStart = performance.now();
    const game = await getGameFromDB(id);
    metrics.db_query = performance.now() - dbStart;
  }
  
  // Response format
  let formatStart = performance.now();
  const response = NextResponse.json({ success: true, data });
  metrics.response_format = performance.now() - formatStart;
  
  // Send metrics
  const totalTime = performance.now() - startTime;
  response.headers.set('X-Response-Time', `${totalTime}ms`);
  response.headers.set('X-Metrics', JSON.stringify(metrics));
  
  return response;
}
```

---

### 13. No Error Tracking

**Issue:** Errors not tracked, hard to debug

**Solution:**
```typescript
// Use error tracking service
import * as Sentry from "@sentry/nextjs";

try {
  // ... route logic
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      route: request.nextUrl.pathname,
      method: request.method,
      userId: payload?.userId,
    },
  });
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

---

## Deployment Issues

### 14. No Zero-Downtime Deployment

**Issue:** Deployments cause service disruption

**Solution:**
```
1. Blue-green deployment:
   - Deploy new version to "green" environment
   - Test thoroughly
   - Switch traffic from blue to green
   - Keep blue as rollback

2. Canary deployment:
   - Deploy to 5% of traffic
   - Monitor for errors
   - Gradually increase to 100%
   - Rollback if issues detected

3. Database migration strategy:
   - Expand schema (add new columns)
   - Deploy code using new columns
   - Backfill existing data
   - Remove old columns
```

---

## Scalability Issues

### 15. Monolithic API Design

**Issue:** All routes in single Next.js app, doesn't scale independently

**Future Improvement:**
```
Current:
Frontend → Next.js API Routes → Databases

Better:
Frontend → API Gateway → Microservices
  ├─ Games Service
  ├─ Auth Service  
  ├─ Images Service
  └─ Analytics Service
```

---

## Recommended Fixes Priority

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| JWT Secret Exposure | Critical | Low | 1 |
| N+1 Queries | High | Medium | 2 |
| No Rate Limiting | High | Medium | 3 |
| Cache Stampede | Medium | Medium | 4 |
| Input Validation | High | Low | 5 |
| Background Worker Crashes | Medium | High | 6 |
| Orphaned Records | Medium | High | 7 |
| Performance Metrics | Low | Medium | 8 |
| Zero-Downtime Deployment | Low | High | 9 |
| Microservices | Low | High | 10 |
