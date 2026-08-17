# API Implementation Guide

_Last updated: 2026-08-17_

## Overview

This guide covers how to create and maintain API routes with Clerk authentication,
standardised error handling (`tryApiRoute` + `classifyError`), idempotency
(UUID v7 + Upstash Redis), caching, validation (Zod), and rate limiting
(Bottleneck + Upstash Redis). All examples are grounded in the current
`app/api/*` routes.

## Route Structure (Current Pattern)

Every route follows this skeleton:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';
import { tryApiRoute } from '@/utilities/apiErrorHandler';

export async function GET(request: NextRequest) {
  // 1. Authentication (Clerk session; no template arg)
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  // 2. Rate limiting (throws → 429)
  try {
    await rateLimitMiddleware(request);
  } catch {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // 3. Business logic wrapped by tryApiRoute
  return tryApiRoute(async () => {
    // Return a plain value → wrapped as { success: true, data }
    // or return a NextResponse directly → passed through unchanged
    const data = await fetchData();
    return data;
  }, "games");
}
```

Key points:
- `validateJWTMiddleware(request)` takes **only** the request and returns
  `{ payload, error }`. No `template`/`secret` arguments.
- `tryApiRoute(fn, context)` automatically wraps a returned value into
  `{ success: true, data }` or a `NextResponse` as-is, and on throw returns a
  classified error response (see Error Handling below).

## Auth + Rate Limiting (copy from `app/api/games/route.ts`)

```typescript
const { error } = await validateJWTMiddleware(request);
if (error) return error;

try {
  await rateLimitMiddleware(request);
} catch {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```

`rateLimitMiddleware` uses a per-IP `Bottleneck` limiter backed by Upstash Redis
(`lib/middleware/rate-limit.ts`). It throws on overflow. There is **no**
`getRateLimit` helper or `lib/rate-limit` import — use `rateLimitMiddleware`
from `@/lib/middleware/rate-limit`.

## Creating a New API Route

### Step 1: Create the file

```
app/
└── api/
    └── your-route/
        └── route.ts
```

### Step 2: Implement GET with id param

Routes use **async `params`** (Next.js 15+):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { tryApiRoute } from '@/utilities/apiErrorHandler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid game ID' }, { status: 400 });
    }

    // ... fetch + return data (a plain value is wrapped in { success, data })
    const data = await getById(id);
    return { id, data };
  }, "your-route");
}
```

### Step 3: Implement POST with Zod validation

Validation uses **Zod** schemas from `types/validation.ts`, never ad-hoc
checks. Example modelled on `app/api/push/route.ts`:

```typescript
import { tryApiRoute } from '@/utilities/apiErrorHandler';
import { pushRequestSchema } from '@/types/validation';

export async function POST(request: NextRequest) {
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  try {
    await rateLimitMiddleware(request);
  } catch {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  return tryApiRoute(async () => {
    const body = await request.json();

    const result = pushRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: result.error.issues },
        { status: 400 }
      );
    }

    const { idempotencyKey, type, data } = result.data;
    // ... use validated data
    return { received: true };
  }, "your-route");
}
```

## Error Handling

### `tryApiRoute` + `classifyError`

`tryApiRoute(fn, context)` catches thrown errors and routes them through
`classifyError(err, context)` (`utilities/errorHandler.ts`), returning a JSON
response with the appropriate status code:

```typescript
// utilities/apiErrorHandler.ts (current)
export async function tryApiRoute<T>(fn: () => Promise<T>, context: string): Promise<Response> {
  try {
    const data = await fn();
    if (data instanceof Response) return data;          // pass through NextResponse
    if (data !== undefined && data !== null) {
      return NextResponse.json({ success: true, data });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiRouteError(err, context);            // classifyError → { success:false, error }
  }
}
```

`classifyError` maps known error message/status patterns to HTTP codes
(400/401/403/404/409/422/429/500/503). Throw a plain `Error` with a descriptive
message (e.g. `throw new Error('Game not found')`) and it will be classified.

You generally do **not** need a custom `handleError` function — `tryApiRoute`
already standardises the shape. Use `classifyError` directly only for logging,
as in `app/api/games/[id]/route.ts`:

```typescript
import { classifyError } from '@/utilities/errorHandler';

retry(() => setGameInCache(id, merged), 3, 500).catch((err) => {
  const classified = classifyError(err, `route-games.backfill.${id}`);
  console.error(`Failed to backfill cache for ${id}:`, classified.message);
});
```

### Validation errors

Prefer Zod `safeParse` (see above). On failure return a `400` `NextResponse`
with `result.error.issues`. Avoid the legacy `validateInput`/`lib/sanitize`
pattern shown in older docs — input sanitisation is handled by Zod schemas.

## Database Operations (Retry Wrapper)

Wrap every database call with the `retry` utility so transient failures are
retried with a fixed (or exponential) backoff:

```typescript
import { retry } from '@/lib/retry';
import { getGameById } from '@/lib/db';

// retry(fn, maxTries = 3, delayMs = 500, exponentialBackoff = false)
const game = await retry(() => getGameById(id), 3, 500);
```

This is the project's "DB retry wrapper": pass an arrow function that performs
the query. Never call the DB function directly without it. For parallel work,
`Promise.all` the retried calls as in `app/api/games/[id]/route.ts`:

```typescript
const [pgGame, mongoGame] = await Promise.all([
  retry(() => getGameById(id), 3, 500),
  retry(() => connectDB().then(() => Game.findOne({ id }).lean()), 3, 500),
]);
```

Transactions/inserts go through the queue (`enqueue`) and are drained by workers
(`drainGames` / `drainLikes` in `utilities/pull.ts`), then written via
`insertGamesBatch` / `updateGamesLikesBatch`. See the Queue section.

## Idempotency (UUID v7 + Upstash Redis)

Idempotency keys are **UUID v7** strings. The key is stored in Redis as
`idempotency:<key>` with a TTL of `IDEMPOTENCY_TTL_SECONDS` (300s, 5 min),
exported from `types/api.ts`. Use `withIdempotency` from
`utilities/idempotency.ts`:

```typescript
import { withIdempotency, generateIdempotencyKey } from '@/utilities/idempotency';

// Client sends an idempotencyKey (UUID v7); generate one server-side if needed:
const key = generateIdempotencyKey();

const { result, cached } = await withIdempotency(idempotencyKey, async () => {
  // Side-effecting work runs ONLY on a cache miss.
  await retry(() => enqueue('neon', 'games', gameData), 3, 500);
  return { success: true, message: 'Game added to queue', data: gameData };
});

return NextResponse.json({ ...result, idempotencyKey, cached });
```

Behaviour:
- First call → runs `fn`, caches the result under `idempotency:<key>` (TTL 300s),
  returns `{ result, cached: false }`.
- Replay with same key within TTL → returns the cached result, `fn` is **not**
  re-run, returns `{ result, cached: true }`.

Lower-level helpers (`isRequestProcessed`, `getCachedResult`, `cacheResult`,
`clearIdempotencyKey`, `getIdempotencyKeyInfo`) and `withIdempotencySafe` are
also exported for advanced use.

## Caching (Redis via `lib/cache-warmup.ts`)

The cache layer reads/writes game data in Upstash Redis. Helpers:

- `warmUpCache()` — prime the cache from PostgreSQL (used on first GET).
- `getCachedGameIds()` — ordered list of cached game IDs (the `game:ids:all` zset).
- `getGameFromCache(id)` / `setGameInCache(id, game)` — single-game cache.
- `mergePendingLikes(game)` / `mergePendingLikesBatch(games)` — fold
  `likes:<id>` deltas into `likes_count`.

```typescript
import { getGameFromCache, setGameInCache, mergePendingLikes } from '@/lib/cache-warmup';

let cachedGame = await retry(() => getGameFromCache(id), 3, 500);
if (cachedGame) {
  cachedGame = await mergePendingLikes(cachedGame);
  return NextResponse.json({ success: true, data: cachedGame }, { headers: { 'X-Cache': 'HIT' } });
}

// ... fetch from DB, build fullGame ...
const merged = await mergePendingLikes(fullGame);
retry(() => setGameInCache(id, merged), 3, 500).catch(() => {/* non-fatal */});
return NextResponse.json({ success: true, data: merged }, { headers: { 'X-Cache': 'MISS' } });
```

The `cacheInitialized` flag in `app/api/games/route.ts` is set only after a
warm-up attempt (success or failure) so the warm-up runs at most once per
process.

## The Queue (Redis `rpush`/`rename`/`lrange`)

`utilities/queue.ts` provides `enqueue(provider, queue, payload)` and
`drain(provider, queue)`. The background worker (`lib/GamesInsert.ts` →
`processGamesQueue`) drains the `mongodb`/`games` queue and inserts via
`Game.insertMany`. Likes are drained by `drainLikes`/`drainGames` in
`utilities/pull.ts` and flushed to PostgreSQL.

```typescript
import { enqueue } from '@/utilities/queue';
import { retry } from '@/lib/retry';

await retry(() => enqueue('neon', 'games', gameData), 3, 500);
```

The Redis client is the Upstash client in `lib/queue.ts`. The legacy `ioredis`
implementation is commented out and **not** used.

## Response Format Standards

### Success
```json
{ "success": true, "data": { } }
```

### Error (produced by `tryApiRoute`/`classifyError`)
```json
{ "success": false, "error": "Descriptive message" }
```

### Paginated (from `GET /api/games`)
```json
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasMore": true,
    "source": "redis" | "postgresql"
  }
}
```

## Logging & Monitoring

Use `classifyError(err, context).message` for structured error logs (see above).
For performance, measure with `performance.now()`:

```typescript
const start = performance.now();
const data = await getGamesPaginated(limit, skip);
const duration = performance.now() - start;
if (duration > 1000) console.warn(`[SLOW] GET /api/games took ${duration}ms`);
```

## Security Best Practices (Implemented)

- **Authentication:** `validateJWTMiddleware(request)` + Clerk `proxy.ts`
  `auth.protect()` for every non-public route.
- **Rate limiting:** `rateLimitMiddleware` (Bottleneck + Upstash Redis),
  returns `429` on overflow. Implemented — not "if implemented".
- **Input validation:** Zod schemas in `types/validation.ts`
  (`pushRequestSchema`, `pushGameDataSchema`, `likesSchema`, …).
- **Idempotency:** UUID v7 + Redis, TTL 300s via `withIdempotency`.
- **CORS:** Set explicit headers where cross-origin access is required.
  Prefer the `NEXT_PUBLIC_APP_URL` allow-list over `'*'`.

## Testing API Routes

### cURL
```bash
# GET (token from signed-in session)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/games

# POST with idempotency key + validated body
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"<uuid-v7>","type":"game","data":{...}}' \
  http://localhost:3000/api/push
```

### Fetch from the frontend
```typescript
import { useAuth } from '@clerk/nextjs';

async function testAPI() {
  const { getToken } = useAuth();
  const token = await getToken({ template: 'supabase' });
  const res = await fetch('/api/games', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(await res.json());
}
```

### Edge cases (always 401 without a valid session)
```typescript
test('GET /api/games without token → 401', async () => {
  const res = await fetch('/api/games');
  expect(res.status).toBe(401);
});

test('GET /api/games with invalid token → 401', async () => {
  const res = await fetch('/api/games', { headers: { Authorization: 'Bearer invalid' } });
  expect(res.status).toBe(401);
});

test('POST /api/push with bad body → 400', async () => {
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'game' }), // missing idempotencyKey + data
  });
  expect(res.status).toBe(400);
});
```
