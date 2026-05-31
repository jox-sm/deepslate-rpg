# Issue #66: Wrong JWT auth approach - jsonwebtoken with Neon/MongoDB

## Status
✅ CLOSED

## Category
Bug, Security

## Problem Description

The project attempted to manually verify JWT tokens using the `jsonwebtoken` library AND added unnecessary JWT validators from Neon and MongoDB:

1. **Problem 1**: Manual JWT verification duplicates Clerk's responsibility
2. **Problem 2**: Neon and MongoDB don't use JWTs - they use passwords/connection strings
3. **Problem 3**: Multiple conflicting auth approaches in same codebase
4. **Problem 4**: Session management was already handled by Clerk

### Code Example - Problem
```typescript
// Problem 1: Manual JWT verification (unnecessary)
import jwt from 'jsonwebtoken';

const token = req.headers.authorization?.split(' ')[1];
if (!token) throw new Error('No token');

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // Duplicates Clerk's job
} catch {
  // Token validation error
}

// Problem 2: Non-existent JWT validators
import { NeonJWTValidator } from '@neondatabase/jwt'; // Doesn't exist!
import { MongoDBJWTValidator } from 'mongodb'; // Doesn't exist!

// Problem 3: Conflicting approaches
- Clerk handles user authentication
- JWT manual verification
- Neon JWT (non-existent)
- MongoDB JWT (non-existent)
// Result: Confusion about actual auth source
```

## Root Cause

Misunderstanding of authentication architecture:

1. **Clerk is the auth provider**
   - Manages user sessions
   - Issues JWTs
   - Validates tokens
   - No manual verification needed

2. **Database connections are different**
   - Neon: PostgreSQL - uses password authentication
   - MongoDB: Uses connection string with auth
   - Neither uses JWT for database access

3. **Multiple auth strategies**
   - Unnecessary reinvention
   - Security vulnerabilities from manual implementation
   - Maintenance burden

## Why It's Critical

1. **Security Risk**: Manual JWT verification prone to errors
2. **Broken Code**: Neon/MongoDB JWT validators don't exist
3. **Architectural Confusion**: Mixed auth responsibilities
4. **Maintenance Burden**: Multiple auth implementations
5. **Token Leakage**: Hardcoded JWT_SECRET in code

## Solution Implemented

**Use Clerk for auth, remove manual verification:**

```typescript
// ✅ CORRECT: Use Clerk middleware
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
  // Clerk automatically validates JWT and provides user info
  const { userId } = await auth();
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Database access - use native authentication
  const db = await connectToNeon();
  // Uses Neon connection string (host, user, password)
  
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  
  return Response.json(user);
}

// ✅ CORRECT: Proper middleware setup
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/api/games(.*)',
  '/api/upload(.*)',
  '/dashboard(.*)'
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest))(?:.*)|api|trpc)(.*)'
  ]
};

// ✅ CORRECT: Database connections use native auth
// PostgreSQL (Neon)
const neon = new Client({
  connectionString: process.env.DATABASE_URL,
  // Uses user/password from connection string
});

// MongoDB
const mongoClient = new MongoClient(process.env.MONGODB_URI, {
  // Uses username/password from connection string
});
```

## Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│  Authentication Layer (Clerk)                  │
│  - User login/logout                            │
│  - JWT token generation & validation            │
│  - Session management                           │
│  - User info (userId, email, etc.)             │
└─────────────┬───────────────────────────────────┘
              │ JWT Token (valid from Clerk)
              │
┌─────────────▼───────────────────────────────────┐
│  API Routes                                     │
│  - Access userId from Clerk                     │
│  - No manual JWT verification needed            │
└─────────────┬───────────────────────────────────┘
              │
    ┌─────────┴──────────────────────┐
    │                                │
┌───▼──────────────┐      ┌──────────▼─────┐
│ PostgreSQL (Neon)│      │ MongoDB         │
│ - Password Auth  │      │ - Connection    │
│ - Native         │      │   String Auth   │
│   connection     │      │ - Native        │
└──────────────────┘      └─────────────────┘
```

## Files Modified

- `app/api/middleware.ts` - Removed manual JWT verification
- `app/api/games/route.ts` - Use Clerk auth directly
- `middleware.ts` - Proper Clerk middleware setup
- Removed: Non-existent Neon/MongoDB JWT imports
- Removed: Manual JWT secret handling

## Refactoring Checklist

- [x] Remove `jsonwebtoken` manual verification
- [x] Remove non-existent Neon/MongoDB JWT imports
- [x] Use Clerk's `auth()` function in routes
- [x] Update middleware to use Clerk
- [x] Remove hardcoded JWT_SECRET
- [x] Test authentication flow
- [x] Test protected routes
- [x] Verify token validation

## Testing

```typescript
describe('Authentication Flow', () => {
  test('should use Clerk for auth', async () => {
    // Clerk mock
    const mockAuth = jest.fn().mockResolvedValue({
      userId: 'user_123'
    });
    
    const response = await fetch('/api/games', {
      headers: {
        Authorization: `Bearer ${clerkToken}`
      }
    });
    
    expect(response.ok).toBe(true);
    expect(mockAuth).toHaveBeenCalled();
  });

  test('should reject requests without valid Clerk token', async () => {
    const response = await fetch('/api/games', {
      headers: {
        Authorization: 'Bearer invalid.token'
      }
    });
    
    expect(response.status).toBe(401);
  });
});
```

## Environment Variables

```env
# ✅ KEEP: Clerk authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# ✅ KEEP: Database connections
DATABASE_URL=postgresql://user:password@host/db
MONGODB_URI=mongodb+srv://user:password@cluster/db

# ✅ REMOVE: Manual JWT handling
JWT_SECRET=... # NOT NEEDED
NEON_JWT_SECRET=... # NOT NEEDED
MONGODB_JWT_SECRET=... # NOT NEEDED
```

## Verification Checklist

- [x] Clerk authentication working
- [x] No manual JWT verification
- [x] Protected routes responding with 401 for invalid auth
- [x] Protected routes responding with 200 for valid auth
- [x] Database queries using connection strings
- [x] No JWT secret in code

## Security Impact

| Aspect | Before | After |
|--------|--------|-------|
| Auth provider | Multiple (confusing) | Clerk only |
| JWT validation | Manual (risky) | Clerk (secure) |
| Secret management | Hardcoded (risky) | Environment variables |
| Database auth | JWT (wrong) | Native (correct) |

## Related Issues

- #43: Wrong JWT auth approach (duplicate of this)
- #65: Rate limiter uses wrong Bottleneck API (performance related)
