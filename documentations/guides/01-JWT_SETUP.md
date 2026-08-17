# JWT Implementation Guide

_Last updated: 2026-08-17_

## Overview

Deepslate Dungeons authenticates API requests with **Clerk** server-side. There is
no longer a hand-rolled JWT secret flow — the old `CLERK_JWT_SECRET` /
`NEON_JWT_SECRET` / `MONGODB_JWT_SECRET` environment variables and the
`validateJWT(token, template)` / `extractTokenFromHeader()` helpers are **gone**.

Authentication is provided by `lib/jwt-validate.ts`, which simply wraps Clerk's
`auth()` and exposes a single middleware: `validateJWTMiddleware(request)`.

```ts
// lib/jwt-validate.ts (current implementation)
import { auth } from '@clerk/nextjs/server';

export interface JWTPayload {
  userId: string;
  email?: string;
  [key: string]: unknown;
}

export async function validateJWTMiddleware(
  _request: NextRequest
): Promise<{ payload: JWTPayload; error: null } | { payload: null; error: NextResponse }> {
  const { userId } = await auth();
  if (!userId) {
    return { payload: null, error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) };
  }
  return { payload: { userId }, error: null };
}
```

> The request argument is accepted for signature compatibility but the actual
> identity is resolved from Clerk's session, not from a manually parsed token.
> `validateJWTMiddleware` takes **only** `request` — there is no `template`
> parameter.

## Step 1: Environment Variables

Clerk is configured via its standard environment variables (set in `.env.local`
or your host's secret store). You no longer need any `*_JWT_SECRET` variables.

```env
# Clerk (provided by the Clerk dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Clerk JWT template name used by the app (default: "supabase")
NEXT_PUBLIC_CLERK_SUPABASE_JWT_TEMPLATE=supabase

# Convex (for server-to-server auth from Convex functions)
NEXT_PUBLIC_CLERK_DOMAIN=https://your-subdomain.clerk.accounts.dev

# Supabase (used by the Supabase server client in lib/auth.ts)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Upstash Redis (idempotency + cache + queue)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Optional: public app URL used for internal drain triggers
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 2: Protecting a Route

Import and call `validateJWTMiddleware`. It returns `{ payload, error }`. When
`error` is set it is already a `NextResponse` with status `401` — return it
directly.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function GET(request: NextRequest) {
  // Resolve the Clerk user. No token parsing, no template needed.
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error; // 401 NextResponse

  // payload.userId is now available
  console.log(payload.userId);

  try {
    // ... business logic
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    // Use tryApiRoute in real routes — see the API Implementation guide.
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

## Step 3: Clerk Middleware (proxy.ts)

Route-level checks are a second line of defence. The app-wide guard lives in
`proxy.ts`, which uses `clerkMiddleware` and protects every non-public route:

```typescript
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/test-supabase-auth(.*)',
  '/api/test-neon-auth(.*)',
  '/api/test-mongodb-auth(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});
```

Unless a route is listed as public, `auth.protect()` rejects unauthenticated
requests before they reach the handler.

## Step 4: Getting a Supabase Token from the Frontend

The frontend uses Clerk's `getToken({ template })` to mint a Supabase JWT, which
it then passes in the `Authorization` header. The backend does **not** re-validate
this token manually — the `Authorization` header is only used to derive the
Supabase client (see Step 5).

```typescript
import { useAuth } from '@clerk/nextjs';

export function MyComponent() {
  const { getToken } = useAuth();

  async function fetchGames() {
    const token = await getToken({ template: 'supabase' });
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/games', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      window.location.href = '/sign-in';
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return response.json();
  }

  return <button onClick={fetchGames}>Load Games</button>;
}
```

Clerk refreshes the token automatically; pass `skipCache: true` to `getToken`
only if you explicitly need a fresh token.

## Step 5: Server-Side Supabase Client

To call Supabase from a Server Component or Route Handler, use `lib/auth.ts`
(not the deprecated `lib/supabase-auth.ts` stub, which is now a one-line
placeholder). `createAuthenticatedSupabaseClient` injects the Clerk-minted
Supabase JWT into the client's `Authorization` header.

```typescript
import { useAuth } from '@clerk/nextjs';
import { createAuthenticatedSupabaseClient, getServiceToken } from '@/lib/auth';

export default async function Page() {
  const { getToken } = useAuth();

  // Mint a Supabase JWT from the Clerk template and build an authenticated client.
  const token = await getServiceToken(getToken, 'supabase'); // throws if unauthenticated
  const supabase = await createAuthenticatedSupabaseClient(getToken);

  const { data } = await supabase.from('games').select('*').limit(10);
  return <pre>{JSON.stringify(data)}</pre>;
}
```

`lib/auth.ts` exports:
- `getServiceToken(getToken, 'supabase')` → string JWT
- `createAuthenticatedSupabaseClient(getToken)` → `SupabaseClient`
- `ServiceName` type (currently only `'supabase'`)

## Step 6: Convex Authentication

Convex functions authenticate via Clerk's JWT issuer, configured in
`convex/auth.config.ts`:

```typescript
export default {
  providers: [
    {
      domain: 'https://your-subdomain.clerk.accounts.dev',
      applicationID: 'convex',
    },
  ],
};
```

Inside Convex functions, use the helpers in `convex/authHelpers.ts` rather than
parsing tokens yourself:

```typescript
import { requireAuth, requireStaff, STAFF_DEGREE } from './authHelpers';

export const myQuery = query(async (ctx) => {
  const identity = await requireAuth(ctx); // throws "Unauthenticated" if no user
  const clerkUserId = identity.subject;
  // ...
});

export const adminOnly = mutation(async (ctx) => {
  // Superadmin (degree 4) bypasses; others need the minimum degree.
  const { identity, degree } = await requireStaff(ctx, STAFF_DEGREE.admin);
  // ...
});
```

## Step 7: Accessing the User Identity

`validateJWTMiddleware` returns `{ userId }`. There is no `email`/`role`/`iat`/
`exp` populated from a manual token — if you need profile data, fetch it from
Clerk or your database using `payload.userId`.

```typescript
const { payload, error } = await validateJWTMiddleware(request);
if (error) return error;

const userId = payload.userId;
console.log(`User ${userId} accessed ${request.nextUrl.pathname}`);

// For analytics / audit logging:
analytics.track('api_access', { userId, endpoint: request.nextUrl.pathname });
```

To gate admin features, check against your own user/role table using `userId`
rather than decoding custom JWT claims.

## Step 8: A Reusable Auth Wrapper

Because `validateJWTMiddleware` only needs `request`, you can wrap handlers
cleanly:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateJWTMiddleware, JWTPayload } from '@/lib/jwt-validate';

export function withJWTAuth(
  handler: (req: NextRequest, payload: JWTPayload) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const { payload, error } = await validateJWTMiddleware(request);
    if (error) return error;
    return handler(request, payload);
  };
}

// Usage
export const GET = withJWTAuth(async (request, payload) => {
  const data = await fetchData(payload.userId);
  return NextResponse.json({ success: true, data });
});
```

> In real routes prefer `tryApiRoute` (see the API Implementation guide) which
> also standardises success/error shapes and classification.

## Step 9: Testing Authentication

### Valid request (token comes from the signed-in browser session)
```bash
# Get a token from your frontend first, then:
TOKEN=$(node -e "console.log('get token from browser console')")
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/games
```

### Missing token → 401
```bash
curl http://localhost:3000/api/games
```

### Invalid token → 401
```bash
curl -H "Authorization: Bearer invalid.token.here" http://localhost:3000/api/games
```

### Missing Bearer prefix → 401 (Clerk cannot resolve a session)
```bash
curl -H "Authorization: $TOKEN" http://localhost:3000/api/games
```

## Troubleshooting

### Issue: Always getting 401
1. Confirm `proxy.ts` `isPublicRoute` does **not** include your route (otherwise
   `auth.protect()` rejects it).
2. Verify the request carries a valid Clerk session cookie / `Authorization`
   header.
3. Check Clerk env vars (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`) are set and match the same Clerk instance.
4. For Supabase calls, confirm `NEXT_PUBLIC_CLERK_SUPABASE_JWT_TEMPLATE` matches
   the template name configured in Clerk.

### Issue: Different users seeing 401
1. Verify `getToken({ template: 'supabase' })` returns a value.
2. Check the browser console for Clerk errors.
3. Clear browser cookies and re-authenticate.

### Issue: Token works in some routes but not others
1. The `Authorization` header is **not** what drives `validateJWTMiddleware` —
   identity comes from Clerk's session. Ensure the request is actually
   authenticated (signed-in).
2. Confirm `proxy.ts` matcher covers `/api(.*)`.
3. Keep `validateJWTMiddleware(request)` as the first call in every handler.

### Issue: Performance with auth
1. Clerk's `auth()` is fast and cached per request; no extra caching needed.
2. Prefer `skipCache: false` on `getToken` to reuse a valid Supabase token.

## Best Practices

1. ✅ Call `validateJWTMiddleware(request)` first in every protected handler.
2. ✅ Return the `error` response as-is on failure (already a `401`).
3. ✅ Gate admin features via your own user/role table keyed on `userId`.
4. ✅ Use `lib/auth.ts` for Supabase clients (never the deprecated
   `lib/supabase-auth.ts`).
5. ✅ Use `tryApiRoute` for consistent response/error shapes (see API guide).
6. ✅ Never log Clerk secrets or the user's raw token.
7. ✅ Use HTTPS only in production.
8. ✅ Test with unauthenticated, invalid, and expired sessions.
9. ✅ For Convex, use `requireAuth` / `requireStaff` instead of parsing tokens.
