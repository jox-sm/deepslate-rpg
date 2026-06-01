# JWT Validation Setup Guide

## Overview
JWT validation has been added to all API routes. The system supports three templates:
- **Clerk** (your current setup)
- **Neon** (PostgreSQL)
- **MongoDB**

## Environment Variables

Add these to your `.env.local`:

```env
# Clerk JWT Secret
CLERK_JWT_SECRET=your_clerk_jwt_secret

# Neon JWT Secret (optional)
NEON_JWT_SECRET=your_neon_jwt_secret

# MongoDB JWT Secret (optional)
MONGODB_JWT_SECRET=your_mongodb_jwt_secret
```

## How It Works

### 1. Token Validation Flow
```
Client Request
    ↓
Extract Token from Authorization Header
    ↓
Validate Against Configured Template
    ↓
Return Payload or 401 Error
```

### 2. API Routes with Validation
All these routes now require a valid JWT token:
- `GET /api/games` — List games (paginated)
- `GET /api/games/[id]` — Get single game
- `POST /api/push` — Push data to queue
- `POST /api/push/pushGames` — Push games to queue
- `POST /api/convertUrl` — Upload image
- `POST /api/convertUrl/ConvertGameImages` — Convert game images

### 3. Making Authenticated Requests

**From Client Side:**
```typescript
const token = await getToken({ template: 'supabase' }); // or your template

const response = await fetch('/api/games', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

**From Server Side (Node.js/cURL):**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/games
```

## Validation Behavior

### Single Template (Recommended)
If you know which template you're using, pass it explicitly:

```typescript
const { payload, error } = await validateJWTMiddleware(request, 'clerk');
```

### Multiple Templates (Fallback)
If template is not specified, the validator tries all configured templates in order:
1. Clerk
2. Neon
3. MongoDB

**Note:** This is slower and not recommended for production.

## Error Responses

### Missing Token (401)
```json
{
  "success": false,
  "error": "Missing authorization token"
}
```

### Invalid Token (401)
```json
{
  "success": false,
  "error": "Invalid Clerk JWT: jwt malformed"
}
```

### Other Errors (500)
```json
{
  "success": false,
  "error": "Failed to fetch games"
}
```

## Token Payload

After validation, you get the JWT payload:

```typescript
interface JWTPayload {
  userId: string;
  email?: string;
  iat?: number;      // Issued at
  exp?: number;      // Expiration time
  [key: string]: any; // Additional claims
}

// Access in your route:
const { payload, error } = await validateJWTMiddleware(request);
if (error) return error;

console.log(payload.userId);   // User ID from token
console.log(payload.email);    // User email from token
```

## Switching Templates

To switch between templates globally, modify `lib/jwt-validate.ts`:

```typescript
// Edit the validateJWT function to prefer a specific template
export function validateJWT(token: string, template?: 'clerk' | 'neon' | 'mongodb'): JWTPayload {
  if (template === 'neon') return validateNeonJWT(token);  // Try Neon first
  // ...
}
```

## Testing Locally

### 1. Get a Test Token
```typescript
// In your frontend
const token = await getToken({ template: 'supabase' });
console.log(token);
```

### 2. Use Token in API Call
```bash
curl -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:3000/api/games
```

## Troubleshooting

### "CLERK_JWT_SECRET not configured"
- Add `CLERK_JWT_SECRET` to `.env.local`
- Or use a different template that's configured

### "Failed to validate JWT with any template"
- Check that at least one JWT secret is configured
- Verify the token format: should be a valid JWT (three parts separated by dots)
- Check token expiration: tokens must not be expired

### Token Valid But Still Getting 401
- Verify the `Authorization` header format: must be `Bearer <token>`
- Check for typos in header name (case-sensitive)
- Ensure token is not expired

## Next Steps

1. ✅ Add JWT secrets to `.env.local`
2. ✅ Test authenticated requests from your client
3. ✅ Monitor API responses for 401 errors
4. ✅ Update client code to handle token refresh (if needed)

## Files Modified

- `lib/jwt-validate.ts` — New JWT validation utilities
- `app/api/games/route.ts` — Added JWT validation
- `app/api/games/[id]/route.ts` — Added JWT validation
- `app/api/push/route.ts` — Added JWT validation
- `app/api/push/pushGames/route.ts` — Added JWT validation
- `app/api/convertUrl/route.ts` — Added JWT validation
- `app/api/convertUrl/ConvertGameImages/route.ts` — Added JWT validation
