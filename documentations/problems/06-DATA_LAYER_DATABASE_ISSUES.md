# Data Layer & Database Issues

### MongoDB Connection Pool Lacks Serverless Configuration
**Severity:** LOW
**Location:** `models/games/mongodb/client.ts:5`
**Status:** ❌ Unresolved
**Description:** `mongoose.connect(process.env.MONGODB_URI!)` uses zero configuration options — no `maxPoolSize`, `minPoolSize`, `serverSelectionTimeoutMS`, `socketTimeoutMS`, or `heartbeatFrequencyMS`. In a Next.js serverless/edge runtime, each invocation can create new connections or contend on the default pool (Mongoose default `maxPoolSize=100`), leading to connection starvation under concurrent load. Additionally, the connection readiness check (`mongoose.connection.readyState >= 1`) is a singleton — multiple concurrent requests can race past the guard and all attempt to connect simultaneously.
**Impact:** Connection pool exhaustion under concurrent API requests; serverless cold starts amplify the problem. At 100+ concurrent users, connection timeouts are likely.
**Suggested Fix:**
```typescript
await mongoose.connect(process.env.MONGODB_URI!, {
  maxPoolSize: 10,          // Serverless: keep pools small
  minPoolSize: 0,           // No idle connections in serverless
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
});
App is in development
```

---

### Game `id` Field in MongoDB Missing `unique` Constraint
**Severity:** LOW
**Location:** `models/games/mongodb/schema.ts:26`
**Status:** ❌ Unresolved
**Description:** The `GameSchema` defines `id: { type: String, index: true }` without `unique: true`. This permits duplicate game IDs in MongoDB via `Game.insertMany(gamesQueue, { ordered: false })`. When `ordered: false`, a duplicate ID causes only that single document to fail while the rest insert — but a retry or pipeline glitch can insert a second document with the same `id`. Downstream reads merge Postgres + Mongo data and silently pick whichever Mongo document the query returns first, producing non-deterministic data.
**Impact:** Silent data corruption — same game ID can have multiple MongoDB documents. API responses may return stale or incomplete character/map/item arrays.
**Suggested Fix:** Change line 26 to:
```typescript
id: { type: String, unique: true, index: true },
```
Also add validation before `insertMany` to check for pre-existing IDs, or use `bulkWrite` with upserts instead.

---

### Cross-Database Read/Write Inconsistency (PostgreSQL + MongoDB)
**Severity:** HIGH
**Location:** `app/api/games/[id]/route.ts:31-45`, `app/api/games/[id]/route-gamepage.ts:44-59`, `lib/GamesInsert.ts:10-16`, `lib/db.ts:7-23`
**Status:** ✅ Resolved
**Description:** Game data is split across PostgreSQL (core scalar fields) and MongoDB (characters/maps/items arrays). The write path goes: (1) `insertGame()` inserts into Postgres, (2) a Redis queue triggers `processGamesQueue()` which calls `Game.insertMany()` into MongoDB. There is no distributed transaction or two-phase commit. If the queue processor fails after the Postgres insert but before MongoDB, the game exists in Postgres with empty arrays forever. At read time, the API merges Postgres + Mongo results — if one is stale or missing, the user sees partial data.
**Impact:** Orphaned Postgres records with no MongoDB counterpart; inconsistent game detail pages; data recovery requires manual reconciliation.
**Suggested Fix:**
1. Implement a `status` column in PostgreSQL to track pipeline phases: `pending_mongo`, `complete`.
2. Make `processGamesQueue` idempotent with upsert semantics (`bulkWrite` with `updateOne(filter, update, { upsert: true })`).
3. Add a reconciliation cron that periodically detects Postgres records without matching MongoDB docs and retries the pipeline.
4. Consider an eventual-consistency layer: if MongoDB fetch fails at read time, queue a retry and return a degraded response.

---

### Supabase Client Uses Non-Null Assertions on Env Vars
**Severity:** MEDIUM
**Location:** `lib/supabase.ts:14`
**Status:** ❌ Unresolved
**Description:** `createClient(supabaseUrl!, supabaseKey!)` uses TypeScript non-null assertions (`!`) on runtime environment variables. If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are missing, the error is an opaque `createClient` failure ("Invalid URL" or similar) instead of a clear configuration error. The guard `if (!supabaseUrl || !supabaseKey)` only logs to console but does not prevent the client construction, so production crashes are ambiguous.
**Impact:** Hard-to-diagnose startup failures in production; missing env vars produce confusing error messages instead of actionable ones.
**Suggested Fix:**
```typescript
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables: ' +
    `${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}` +
    `${!supabaseKey ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : ''}`
  );
}
export const supabase = createClient(supabaseUrl, supabaseKey);
```

---

### Retry Logic Uses Fixed Delay Without Exponential Backoff or Jitter
**Severity:** MEDIUM
**Location:** `lib/retry.ts:1-21`
**Status:** ❌ Unresolved
**Description:** The `retry()` function sleeps a fixed `delayMs` between retries (`await new Promise(resolve => setTimeout(resolve, delayMs))`). Without exponential backoff (`delay * 2^n`) and random jitter, a transient database failure (e.g., PG connection spike, MongoDB replica failover) causes all concurrent requests to retry at identical intervals, creating cascading thundering-herd retry storms. This pattern amplifies outages under load.
**Impact:** Under transient failures, retries synchronize across all requests and overwhelm the database further, turning blips into outages.
**Suggested Fix:**
```typescript
const baseDelay = Math.min(delayMs * Math.pow(2, attempt - 1), 10000);
const jitter = Math.random() * baseDelay * 0.1; // 10% jitter
await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
```

---

### Batch Fetch Pipeline Has Race Condition in Queue Dequeue
**Severity:** MEDIUM
**Location:** `utilities/gameFetchPipeline.ts:69-153`
**Status:** ❌ Unresolved
**Description:** The `processBatch()` function reads items from Redis via `lrange()` (lines 69-73) to get a snapshot of pending requests, then individually calls `rpop()` (line 152) to remove each processed item. Between the `lrange` and `rpop`, another concurrent process (e.g., a second serverless function instance) can pick up the same items. This produces duplicate processing and wasted work. The items are only removed after processing, so crashes during batch processing cause the same items to be re-processed on retry.
**Impact:** Duplicate game fetch requests; wasted DB round-trips; potential rate-limit hits on upstream services.
**Suggested Fix:** Use an atomic queue drain pattern. Replace `lrange` + per-item `rpop` with `lrange` + `ltrim` before processing:
```typescript
const requestsJson = (await redis.lrange(QUEUE_KEYS.FETCH_QUEUE, 0, BATCH_SIZE - 1)) as string[];
if (requestsJson.length === 0) return;
await redis.ltrim(QUEUE_KEYS.FETCH_QUEUE, requestsJson.length, -1);
// ... process requestsJson ...
```
This ensures items are atomically removed before processing, preventing duplicate pickup.

---

### Redis Queue Key Collision Between Neon and MongoDB Providers
**Severity:** LOW
**Location:** `types/operations.ts:9-18`
**Status:** ❌ Unresolved
**Description:** The `queueConfig` has `neon.likes` and `mongodb.likes` both mapped to `redisKey: "InsertLikes"`. This means like-sync actions from both providers write to the same Redis list. When `drain("mongodb", "likes")` runs, it may drain items that were enqueued for Neon, and vice versa. The drain logic has no provider discriminator in the payload — it only serializes the raw data with a timestamp — so downstream processors cannot distinguish the source.
**Impact:** Likes data from different DB backends intermingle in a single queue, potentially causing duplicate processing or incorrect write-back to the wrong database.
**Suggested Fix:** Assign distinct keys:
```typescript
mongodb: {
  likes: { redisKey: "InsertLikes:mongodb" },
},
```
Or embed the provider name in every enqueued payload so the drain processor can route correctly.

---

### MongoDB Subdocument Schema Allows Null Images but Zod Enforces Non-Nullable String
**Severity:** LOW
**Location:** `models/games/mongodb/schema.ts:5-9`, `types/validation.ts:46-52`
**Status:** ⚠️ Partially Mitigated
**Description:** The Mongoose `CharacterSchema.image` field defaults to `null` (`image: { type: String, default: null }`), but the Zod `characterDataDBSchema` requires `image: z.string()` (non-nullable). The TypeScript type `CharacterDataDB` also defines `image: string`. This mismatch means at runtime, MongoDB can return `null` for an image while downstream code (rendering `<img src={char.image} />`) expects a string. The same issue exists for `MapSchema` and `ItemSchema`.
**Impact:** Potential client-side crashes rendering null image URLs; silent breakage when MongoDB documents have null images.
**Suggested Fix:**
```typescript
// Option A: Make schema consistently require string (Zod + Mongoose)
image: { type: String, required: true },

// Option B: Align types to allow null/undefined
image: z.string().nullable(),
```
Also apply the corresponding fix to the Mongoose subdoc schemas for maps and items.

---

### PostgreSQL `schema.sql` Not Tracked in Automated Migration Pipeline
**Severity:** LOW
**Location:** `db/schema.sql:1-14`
**Status:** ⚠️ Partially Mitigated
**Description:** The schema is defined in a standalone SQL file rather than an automated migration framework (e.g., Postgrator, node-pg-migrate, or Prisma Migrate). There is no version tracking, no rollback capability, and no CI-enforced schema drift detection. The application code assumes the schema has been manually applied to the Neon database. If the schema file is updated but the database is not migrated, production queries fail with missing columns/ indexes.
**Impact:** Schema drift between environments; manual deployment steps; fragile production rollouts.
**Suggested Fix:** Integrate a migration tool (e.g., `node-pg-migrate` or `postgrator`) with a `package.json` script. Create an initial migration from `schema.sql` and add the `db/migrations/` directory. Fail the build if unapplied migrations exist.
