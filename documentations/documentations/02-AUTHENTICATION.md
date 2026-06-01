# Authentication System Documentation

## Overview
The authentication system uses JWT tokens with support for multiple providers:
- **Clerk** (primary)
- **Supabase Auth**
- **Neon (custom JWT)**
- **MongoDB (custom JWT)**

## JWT Validation Flow

```
Client Request
    ↓
Extract "Authorization: Bearer <token>" header
    ↓
Validate JWT Signature
├─ Try Clerk secret
├─ Try Neon secret
└─ Try MongoDB secret
    ↓
Check Token Expiration
    ↓
Decode Token Claims
    ├─ userId
    ├─ email
    ├─ iat (issued at)
    └─ exp (expiration)
    ↓
Pass Payload to Route Handler
```

## Middleware Integration

All API routes use `validateJWTMiddleware`:

```typescript
const { payload, error } = await validateJWTMiddleware(request, 'clerk');
if (error) return error;  // Returns 401
```

## Token Payload Structure

```typescript
{
  userId: string;        // User ID from Clerk
  email?: string;        // User email
  iat: number;           // Issued at timestamp
  exp: number;           // Expiration timestamp
  [key: string]: any;    // Additional claims
}
```

## Protected Routes

All routes require valid JWT:

| Route | Method | Purpose | Auth Template |
|-------|--------|---------|---|
| /api/games | GET | List games | Clerk (default) |
| /api/games/[id] | GET | Get single game | Clerk (default) |
| /api/push | POST | Push to queue | Clerk (default) |
| /api/push/pushGames | POST | Push games | Clerk (default) |
| /api/convertUrl | POST | Upload images | Clerk (default) |
| /api/convertUrl/ConvertGameImages | POST | Convert images | Clerk (default) |

## Error Responses

### Missing Token
```json
{
  "success": false,
  "error": "Missing authorization token",
  "statusCode": 401
}
```

### Invalid Token
```json
{
  "success": false,
  "error": "Invalid Clerk JWT: jwt malformed",
  "statusCode": 401
}
```

### Expired Token
```json
{
  "success": false,
  "error": "Invalid Clerk JWT: jwt expired",
  "statusCode": 401
}
```

## Clerk Integration

### Token Generation
```typescript
const token = await getToken({ template: 'supabase' });
```

### Token Storage
- **Browser:** localStorage or sessionStorage
- **Mobile:** Secure storage
- **Cookie:** HttpOnly cookie (secure option)

### Token Refresh
```typescript
// Clerk handles automatic token refresh
const token = await getToken({ template: 'supabase', skipCache: true });
```

## Supabase Auth Integration

### Authenticated Client Creation

```typescript
const supabaseClient = await createAuthenticatedSupabaseClient(getToken);
```

### Implementation

```typescript
async function createAuthenticatedSupabaseClient(
  getToken: (options?: { template?: string }) => Promise<string | null>
): Promise<SupabaseClient> {
  const token = await getServiceToken(getToken, 'supabase');
  
  return createClient(baseUrl, apiKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
```

## Multi-Template Support

### Templated Token Generation

```typescript
// Request token with specific template
const clerkToken = await getToken({ template: 'supabase' });
const neonToken = await getToken({ template: 'neon' });
const mongoToken = await getToken({ template: 'mongodb' });
```

### Dynamic Validation

```typescript
// Validate against specific template
const payload = validateJWT(token, 'neon');

// Or try all templates
const payload = validateJWT(token);  // Tries all in order
```

## Security Considerations

1. **Token Storage**
   - Never store in localStorage for sensitive apps
   - Use secure httpOnly cookies
   - Clear on logout

2. **Token Transmission**
   - Always use HTTPS in production
   - Include in Authorization header
   - Never include in URL parameters

3. **Token Expiration**
   - Short-lived access tokens (15-60 minutes)
   - Refresh tokens for long-term access
   - Automatic refresh via Clerk

4. **Secret Management**
   - Keep JWT secrets in environment variables
   - Rotate secrets periodically
   - Never commit secrets to git

## Testing Authentication

### Get Test Token
```bash
# In browser console
const token = await getToken({ template: 'supabase' });
console.log(token);
```

### Test API Endpoint
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/games
```

### Test Invalid Token
```bash
# Missing token (should return 401)
curl http://localhost:3000/api/games

# Invalid token (should return 401)
curl -H "Authorization: Bearer invalid.token.here" \
  http://localhost:3000/api/games
```

## Troubleshooting

### "Not authenticated - could not get X token"
- User not logged in
- Clerk session expired
- Missing Clerk configuration

### "Missing CLERK_JWT_SECRET"
- Environment variable not set
- Check .env.local file
- Restart development server

### "Invalid JWT signature"
- Token from different provider
- Secret key mismatch
- Token tampered with

### Token always returns 401
- Check Authorization header format: `Bearer <token>`
- Verify token not expired
- Check secret in environment variables
- Verify token is valid JWT (three dot-separated parts)
