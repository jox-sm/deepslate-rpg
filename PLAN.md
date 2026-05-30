# Implementation Plan

## Task 1: JWT Integration for Neon and MongoDB

### Overview
Extend the Clerk JWT integration to Neon PostgreSQL and MongoDB, similar to the existing Supabase integration.

### What's Clear

#### Neon PostgreSQL JWT
- Create JWT template "neon" in Clerk dashboard
- Update `lib/auth.ts` to create authenticated Neon connection
- Neon uses connection string with JWT as password
- Connection format: `postgresql://user:password@host/db?sslmode=require`

#### MongoDB JWT
- Create JWT template "mongodb" in Clerk dashboard
- Update `lib/auth.ts` to create authenticated MongoDB connection
- MongoDB can use JWT for authentication via `authMechanism=MONGODB-X509`

### What's Unclear

**Question 1:** For Neon, do you want to:
- A) Replace the current `DATABASE_URL` connection with JWT-authenticated connection?
- B) Keep both options (anonymous for server-side, JWT for client-side)?
option A make sure that client is authenticated then access DB

**Question 2:** For MongoDB, do you want to:
- A) Replace the current `MONGODB_URI` connection with JWT-authenticated connection?
- B) Keep both options?
option A make sure that client is authenticated then access DB

**Question 3:** Should the JWT templates use:
- A) Clerk's default RS256 (like Supabase)?
- B) Custom signing key (HS256)?
A use default RS256
### Implementation Steps

#### Step 1: Create Clerk JWT Templates
```bash
# In Clerk Dashboard:
1. Create "neon" template with RS256
2. Create "mongodb" template with RS256
```

#### Step 2: Update lib/auth.ts
```typescript
// Add Neon authenticated connection
export async function createAuthenticatedNeonClient(
  getToken: (options?: { template?: string }) => Promise<string | null>
): Promise<NeonClient> {
  const token = await getServiceToken(getToken, 'neon');
  const config = serviceConfigs.neon;
  return neon(config.baseUrl + `?sslmode=require&password=${token}`);
}

// Add MongoDB authenticated connection
export async function createAuthenticatedMongoDBClient(
  getToken: (options?: { template?: string }) => Promise<MongoClient> {
  const token = await getServiceToken(getToken, 'mongodb');
  const config = serviceConfigs.mongodb;
  return MongoClient.connect(config.baseUrl, {
    authMechanism: 'MONGODB-X509',
    authMechanismProperties: { JWT: token },
    authSource: 'admin',
  });
}
```

#### Step 3: Update API Routes
- Update routes that use Neon/MongoDB to accept authenticated clients
- Pass JWT token from Clerk to database connections

#### Step 4: Update hooks/useAuth.ts
- Add `neon` and `mongodb` clients to the hook return
- Update `createClients` function

---

## Task 2: Idempotency with UUID v7 and AbortController

### Overview
Implement idempotency for API requests using UUID v7 as idempotency keys. If a request fails, abort it and retry with the same UUID to prevent duplicate operations.

### What's Clear

#### UUID v7 for Idempotency
- Generate UUID v7 for each API request (timestamp-based, sortable)
- Include UUID in request body or header
- Server stores processed UUIDs to detect duplicates
- If request fails, retry with SAME UUID

#### AbortController for Request Cancellation
- Use AbortController to cancel failed requests
- If request times out or fails, abort it
- Retry with same UUID after abort

### What's Unclear

**Question 1:** Where should idempotency be enforced?
- A) Client-side only (frontend generates UUID, backend ignores)
backend doesn't ignore, actually backend uses it at requests so when same process is at reddis cache it gets mapped to same result so no need to do same process again and again and again
- B) Server-side (backend stores processed UUIDs, rejects duplicates)
well it rejects duplicate by reddis it just return same result
to handle it we can make a custom error throw which is duplicated_request for example and catch it 
- C) Both (frontend generates, backend validates)


**Question 2:** Which APIs need idempotency?
- A) Only `/api/push` (game creation)
- B) Only `/api/push/pushGames` (MongoDB insertion)
- C) Both `/api/push` and `/api/push/pushGames`
- D) All write APIs (`/api/push`, `/api/push/pushGames`, `/api/convertUrl`)
option D all apis and use abort controller too so when request falls down and throws error it accept re request and send msg that request aborted or whatever or smth went wrong and user can resend
**Question 3:** How long should idempotency keys be valid?
- A) 24 hours (match Redis TTL)
- B) 1 hour
- C) Until explicitly cleared
until request get succsed let's say 5 minutes
**Question 4:** For AbortController, what timeout do you want?
- A) 10 seconds
- B) 30 seconds
- C) No timeout (manual abort only)
10 seconds is fine
### Implementation Steps

#### Step 1: Update Types
```typescript
// types/api.ts
export interface IdempotentRequest {
  idempotencyKey: string; // UUID v7
  data: unknown;
}

export interface ApiResponse {
  success: boolean;
  idempotencyKey: string;
  error?: string;
}
```

#### Step 2: Update Utilities
```typescript
// utilities/idempotency.ts
import { v7 as uuidv7 } from 'uuid';

export function generateIdempotencyKey(): string {
  return uuidv7();
}

export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  redis: Redis
): Promise<T> {
  // Check if already processed
  const processed = await redis.get(`idempotency:${key}`);
  if (processed) {
    return JSON.parse(processed);
  }
  
  // Execute and store result
  const result = await fn();
  await redis.set(`idempotency:${key}`, JSON.stringify(result), 'EX', 86400);
  return result;
}
```

#### Step 3: Update API Routes
```typescript
// app/api/push/route.ts
export async function POST(request: Request) {
  const { idempotencyKey, type, data } = await request.json();
  
  return withIdempotency(idempotencyKey, async () => {
    // Existing logic...
  }, redis);
}
```

#### Step 4: Update Client-Side
```typescript
// hooks/useIdempotentRequest.ts
import { v7 as uuidv7 } from 'uuid';

export function useIdempotentRequest() {
  const requestRef = useRef<Map<string, AbortController>>(new Map());
  
  const sendRequest = useCallback(async (url: string, data: unknown) => {
    const key = uuidv7();
    const controller = new AbortController();
    requestRef.current.set(key, controller);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key, ...data }),
        signal: controller.signal,
      });
      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted, retrying with same key...');
        // Retry with same key
        return sendRequest(url, data);
      }
      throw error;
    } finally {
      requestRef.current.delete(key);
    }
  }, []);
  
  const abortRequest = useCallback((key: string) => {
    const controller = requestRef.current.get(key);
    if (controller) {
      controller.abort();
    }
  }, []);
  
  return { sendRequest, abortRequest };
}
```

#### Step 5: Update Form Component
```typescript
// components/adventures/form/form.tsx
const { sendRequest, abortRequest } = useIdempotentRequest();

const handleFinalSubmit = useCallback(async (wizardData) => {
  try {
    await sendRequest('/api/push', { type: 'game', data: gameData });
    await sendRequest('/api/push/pushGames', convertedGame);
  } catch (error) {
    console.error('Request failed:', error);
  }
}, [sendRequest]);
```

---

## Questions Summary

### Task 1 (JWT):
1. Replace or keep both connection options for Neon?
2. Replace or keep both connection options for MongoDB?
3. RS256 (default) or HS256 (custom) for JWT templates?

### Task 2 (Idempotency):
1. Client-side only, server-side, or both?
2. Which APIs need idempotency?
3. How long should idempotency keys be valid?
4. What timeout for AbortController?

---

## Pending Answers

*[Awaiting user responses to questions above]*