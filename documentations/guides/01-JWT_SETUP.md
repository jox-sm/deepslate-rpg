# JWT Implementation Guide

## Step 1: Setup Environment Variables

Create `.env.local` in project root:

```env
# Clerk JWT Secret (Required)
CLERK_JWT_SECRET=your_clerk_secret_key_here

# Optional: Neon JWT Secret
NEON_JWT_SECRET=your_neon_secret_key_here

# Optional: MongoDB JWT Secret
MONGODB_JWT_SECRET=your_mongodb_secret_key_here
```

## Step 2: Understanding JWT Validation

The `lib/jwt-validate.ts` file provides three main functions:

### Extract Token
```typescript
import { extractTokenFromHeader } from '@/lib/jwt-validate';

// Gets token from "Authorization: Bearer <token>"
const token = extractTokenFromHeader(request);
if (!token) {
  return NextResponse.json({ error: 'Missing token' }, { status: 401 });
}
```

### Validate Token
```typescript
import { validateJWT } from '@/lib/jwt-validate';

// Option 1: Validate with specific template (recommended)
const payload = validateJWT(token, 'clerk');

// Option 2: Try all templates
const payload = validateJWT(token);
```

### Use in Middleware
```typescript
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function GET(request: NextRequest) {
  // Returns { payload, error }
  const { payload, error } = await validateJWTMiddleware(request, 'clerk');
  
  if (error) return error;  // Returns 401 response
  
  // payload is now available
  console.log(payload.userId);
  console.log(payload.email);
}
```

## Step 3: Add JWT to Existing Route

### Before (No Auth)
```typescript
export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### After (With JWT)
```typescript
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function GET(request: NextRequest) {
  // Add this at the top
  const { payload, error } = await validateJWTMiddleware(request, 'clerk');
  if (error) return error;
  
  try {
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

## Step 4: Making Authenticated Requests from Frontend

### Using Clerk getToken()
```typescript
import { useAuth } from '@clerk/nextjs';

export function MyComponent() {
  const { getToken } = useAuth();
  
  async function fetchGames() {
    const token = await getToken({ template: 'supabase' });
    
    const response = await fetch('/api/games', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    return data;
  }
  
  return (
    <button onClick={fetchGames}>
      Load Games
    </button>
  );
}
```

### Error Handling
```typescript
async function fetchGames() {
  try {
    const token = await getToken({ template: 'supabase' });
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch('/api/games', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.status === 401) {
      // Token expired or invalid
      // Clear stored token and redirect to login
      window.location.href = '/sign-in';
      return;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch games:', error);
    // Show error to user
  }
}
```

## Step 5: Testing JWT Implementation

### Test 1: Valid Token Request
```bash
# Get token from your frontend first
TOKEN=$(node -e "console.log('get token from browser console')")

# Make request with token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/games
```

### Test 2: Missing Token
```bash
# This should return 401
curl http://localhost:3000/api/games
```

### Test 3: Invalid Token
```bash
# This should return 401
curl -H "Authorization: Bearer invalid.token.here" \
  http://localhost:3000/api/games
```

### Test 4: Token Without Bearer Prefix
```bash
# This should return 401 (missing Bearer prefix)
curl -H "Authorization: $TOKEN" \
  http://localhost:3000/api/games
```

## Step 6: Switching Between Auth Templates

### Single Template (Recommended for Production)
```typescript
// Specify template in all routes for consistency
const { payload, error } = await validateJWTMiddleware(request, 'neon');
```

### Multiple Templates (Development/Testing)
```typescript
// Try templates in order: Clerk → Neon → MongoDB
const { payload, error } = await validateJWTMiddleware(request);
```

### Dynamic Template Selection
```typescript
// Get template from query parameter or env variable
const template = process.env.JWT_TEMPLATE || 'clerk';
const { payload, error } = await validateJWTMiddleware(request, template as any);
```

## Step 7: Token Payload Usage

### Access User Information
```typescript
const { payload, error } = await validateJWTMiddleware(request);
if (error) return error;

const userId = payload.userId;
const email = payload.email;
const issuedAt = new Date(payload.iat * 1000);
const expiresAt = new Date(payload.exp * 1000);

console.log(`User ${userId} (${email}) token expires at ${expiresAt}`);
```

### Log User Actions
```typescript
const { payload } = await validateJWTMiddleware(request);

console.log(`User ${payload.userId} accessed /api/games`);

// In production, send to analytics
analytics.track('api_access', {
  userId: payload.userId,
  endpoint: '/api/games',
  timestamp: new Date(),
});
```

### Store in Database
```typescript
const { payload } = await validateJWTMiddleware(request);

// Create or update user session in database
await db.query(
  'INSERT INTO user_sessions (user_id, token, accessed_at) VALUES ($1, $2, now())',
  [payload.userId, request.headers.get('authorization')]
);
```

## Step 8: Advanced: Custom Claims

### Add Claims to Token
If using custom JWT generation:

```typescript
const token = jwt.sign(
  {
    userId: user.id,
    email: user.email,
    role: 'admin',              // Custom claim
    permissions: ['read', 'write'],  // Custom claim
    customData: { /* ... */ },   // Custom claim
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Use Custom Claims
```typescript
const { payload } = await validateJWTMiddleware(request);

if (payload.role === 'admin') {
  // Allow admin operations
}

if (payload.permissions.includes('write')) {
  // Allow write operations
}
```

## Step 9: Token Refresh Strategy

### Automatic Refresh with Clerk
```typescript
// Clerk handles automatic refresh
const token = await getToken({ 
  template: 'supabase',
  skipCache: false  // Use cached token if valid
});
```

### Manual Refresh
```typescript
// Force refresh without cache
const token = await getToken({ 
  template: 'supabase',
  skipCache: true  // Always get fresh token
});
```

### Refresh on Demand
```typescript
async function getValidToken() {
  const token = await getToken({ template: 'supabase' });
  
  // Decode token to check expiration
  const decoded = jwt_decode(token);
  const expiresIn = decoded.exp * 1000 - Date.now();
  
  // If expires in less than 1 minute, refresh
  if (expiresIn < 60000) {
    return await getToken({ 
      template: 'supabase',
      skipCache: true  // Force refresh
    });
  }
  
  return token;
}
```

## Step 10: Monitoring & Debugging

### Log JWT Validation
```typescript
export async function GET(request: NextRequest) {
  const { payload, error } = await validateJWTMiddleware(request);
  
  if (error) {
    console.warn('[JWT] Validation failed:', {
      path: request.nextUrl.pathname,
      method: request.method,
      timestamp: new Date(),
    });
    return error;
  }
  
  console.log('[JWT] Valid token', {
    userId: payload.userId,
    email: payload.email,
  });
  
  // Continue...
}
```

### Create JWT Middleware Wrapper
```typescript
export async function withJWTAuth(
  handler: (req: NextRequest, payload: JWTPayload) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const { payload, error } = await validateJWTMiddleware(request);
    if (error) return error;
    
    return handler(request, payload);
  };
}

// Use it
export const GET = withJWTAuth(async (request, payload) => {
  // Handler code with automatic JWT validation
  const data = await fetchData(payload.userId);
  return NextResponse.json({ success: true, data });
});
```

## Troubleshooting

### Issue: Always getting 401
**Solution:**
1. Check `.env.local` has correct secret
2. Verify token format: three parts separated by dots
3. Check token not expired: decode and check `exp` claim
4. Verify Authorization header format: `Bearer <token>`

### Issue: Different users seeing 401
**Solution:**
1. Check Clerk configuration for user
2. Verify getToken() returns a value
3. Check browser console for Clerk errors
4. Clear browser cookies and retry

### Issue: Token works in some routes but not others
**Solution:**
1. Check all routes use same template (or all support multiple)
2. Verify JWT_SECRET is same across environment
3. Check middleware order: JWT validation must be first
4. Verify request headers preserved in middleware chain

### Issue: Performance degradation with JWT validation
**Solution:**
1. Cache token validation if possible
2. Use specific template instead of trying all
3. Implement token caching at frontend
4. Use skipCache: false to use cached tokens

## Best Practices

1. ✅ Always use specific template (not fallback)
2. ✅ Validate JWT at start of route handler
3. ✅ Return 401 on validation failure
4. ✅ Never expose JWT secret in logs
5. ✅ Use HTTPS only in production
6. ✅ Implement token refresh strategy
7. ✅ Log failed authentication attempts
8. ✅ Clear stored tokens on logout
9. ✅ Test with expired tokens
10. ✅ Monitor JWT validation errors
