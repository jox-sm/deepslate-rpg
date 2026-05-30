# API Implementation Guide

## Overview
This guide covers how to create and maintain API routes with proper authentication, error handling, and caching.

## Route Structure

All API routes follow this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function GET(request: NextRequest) {
  // 1. Authentication
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;
  
  try {
    // 2. Parse input
    // 3. Business logic
    // 4. Database operations
    // 5. Return response
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Creating a New API Route

### Step 1: Create Route File

```
app/
└── api/
    └── your-route/
        └── route.ts
```

### Step 2: Implement GET Handler

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function GET(request: NextRequest) {
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;
  
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing id parameter' },
        { status: 400 }
      );
    }
    
    // Fetch data
    const data = await fetchData(id);
    
    // Return success
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[API GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

### Step 3: Implement POST Handler

```typescript
export async function POST(request: NextRequest) {
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;
  
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Add user context from JWT
    const data = await createData({
      ...body,
      userId: payload.userId,
      createdAt: new Date(),
    });
    
    return NextResponse.json({
      success: true,
      message: 'Data created successfully',
      data,
    }, { status: 201 });
  } catch (error) {
    console.error('[API POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create data' },
      { status: 500 }
    );
  }
}
```

## Handling Route Parameters

### GET with ID Parameter

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;
  
  try {
    const { id } = await params;
    
    // Validate ID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID format' },
        { status: 400 }
      );
    }
    
    const data = await fetchDataById(id);
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch' },
      { status: 500 }
    );
  }
}
```

## Response Format Standards

### Success Response
```json
{
  "success": true,
  "data": { /* actual data */ },
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [/* items */],
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

## Caching Implementation

### Cache Retrieval
```typescript
import { getGameFromCache } from '@/lib/cache-warmup';

const cachedData = await getGameFromCache(id);

if (cachedData) {
  return NextResponse.json(
    { success: true, data: cachedData },
    { headers: { 'X-Cache': 'HIT' } }
  );
}
```

### Cache Population
```typescript
import { setGameInCache } from '@/lib/cache-warmup';

// After fetching from database
await setGameInCache(id, data);

return NextResponse.json(
  { success: true, data },
  { headers: { 'X-Cache': 'MISS' } }
);
```

## Idempotency Implementation

### Extract Idempotency Key
```typescript
const body = await request.json();
const { idempotencyKey, ...data } = body;

if (!idempotencyKey) {
  return NextResponse.json(
    { success: false, error: 'Missing idempotencyKey' },
    { status: 400 }
  );
}
```

### Check Idempotency
```typescript
import { withIdempotency } from '@/utilities/idempotency';

const { result, cached } = await withIdempotency(idempotencyKey, async () => {
  // Your business logic here
  return { success: true, data };
});

return NextResponse.json({
  ...result,
  idempotencyKey,
  cached,
});
```

## Error Handling

### Standardized Error Handler
```typescript
function handleError(error: unknown, context: string) {
  console.error(`[API ${context}] Error:`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });
  
  return NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  );
}

// Usage
try {
  // ...
} catch (error) {
  return handleError(error, 'GET /api/route');
}
```

### Validation Error Handler
```typescript
function validateInput(data: any, schema: any) {
  const errors: string[] = [];
  
  if (!data.name) errors.push('Missing name');
  if (!data.description) errors.push('Missing description');
  if (typeof data.name !== 'string') errors.push('Name must be string');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Usage
const { valid, errors } = validateInput(body, gameSchema);
if (!valid) {
  return NextResponse.json(
    { success: false, errors },
    { status: 400 }
  );
}
```

## Database Operations

### Safe Query Execution
```typescript
import { retry } from '@/lib/retry';

async function safeQuery(fn: () => Promise<any>, maxRetries = 3) {
  try {
    return await retry(fn, maxRetries, 500);
  } catch (error) {
    console.error('Query failed after retries:', error);
    throw new Error('Database operation failed');
  }
}

// Usage
const data = await safeQuery(() => getGameById(id));
```

### Transaction Handling
```typescript
async function createGameWithDetails(gameData: any, details: any) {
  try {
    // Begin transaction
    await db.query('BEGIN');
    
    // Insert game
    const game = await db.query(
      'INSERT INTO games (...) VALUES (...) RETURNING *',
      [...gameData]
    );
    
    // Insert details
    await db.query(
      'INSERT INTO game_details (...) VALUES (...)',
      [...details]
    );
    
    // Commit
    await db.query('COMMIT');
    
    return game;
  } catch (error) {
    // Rollback
    await db.query('ROLLBACK');
    throw error;
  }
}
```

## Logging & Monitoring

### Structured Logging
```typescript
function logRequest(request: NextRequest, context: string) {
  console.log(`[${context}] ${request.method} ${request.nextUrl.pathname}`, {
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for'),
  });
}

// Usage in route
export async function GET(request: NextRequest) {
  logRequest(request, 'API');
  
  // ...
}
```

### Performance Monitoring
```typescript
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // ... route logic
    
    const duration = performance.now() - startTime;
    console.log(`[PERF] Route completed in ${duration.toFixed(2)}ms`);
    
    if (duration > 1000) {
      console.warn(`[SLOW] Route took ${duration}ms`);
    }
  } catch (error) {
    // ...
  }
}
```

## Security Best Practices

### Rate Limiting (if implemented)
```typescript
import { getRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  const { allowed } = await getRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  // ...
}
```

### Input Sanitization
```typescript
import { sanitizeInput } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const cleanData = {
    name: sanitizeInput(body.name),
    description: sanitizeInput(body.description),
  };
  
  // Use cleanData
}
```

### CORS Headers (if needed)
```typescript
return NextResponse.json(
  { success: true, data },
  {
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST',
    },
  }
);
```

## Testing API Routes

### Test with cURL
```bash
# GET request
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/games

# POST request
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"Test"}' \
  http://localhost:3000/api/games
```

### Test with Fetch
```typescript
async function testAPI() {
  const token = await getToken({ template: 'supabase' });
  
  const response = await fetch('/api/games', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  console.log(await response.json());
}
```

### Test Edge Cases
```typescript
// Test 1: No auth token
test('GET /api/games without token', async () => {
  const res = await fetch('/api/games');
  expect(res.status).toBe(401);
});

// Test 2: Invalid token
test('GET /api/games with invalid token', async () => {
  const res = await fetch('/api/games', {
    headers: { 'Authorization': 'Bearer invalid' },
  });
  expect(res.status).toBe(401);
});

// Test 3: Missing required field
test('POST /api/games without name', async () => {
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ description: 'No name' }),
  });
  expect(res.status).toBe(400);
});
```
