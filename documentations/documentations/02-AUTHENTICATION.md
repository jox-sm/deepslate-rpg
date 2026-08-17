# Authentication System Documentation

> Last reviewed against: `lib/jwt-validate.ts`, `lib/auth.ts`, `proxy.ts`, `convex/authHelpers.ts`, `convex/staff.ts`, `utilities/security/*`, `utilities/apiErrorHandler.ts`, `utilities/idempotency.ts`.

## Overview

Authentication is built on **Clerk** as the single identity provider. Clerk issues two kinds of tokens that downstream services consume:

- **Clerk session tokens** consumed server-side in Next.js API routes via the `@clerk/nextjs/server` `auth()` helper (`lib/jwt-validate.ts:15`).
- **Clerk JWT templates** (e.g. the `supabase` template) minted by the frontend with `getToken({ template: 'supabase' })` and forwarded to **Supabase** so the server can act as the authenticated user (`lib/auth.ts:28`, `hooks/useAuth.ts:36`).
- **Convex** trusts Clerk directly through a JWKS provider configured in `convex/auth.config.ts:2` (domain `https://funky-goose-55.clerk.accounts.dev`, `applicationID: "convex"`), so Convex functions read the caller's Clerk identity via `ctx.auth.getUserIdentity()`.

There is **no custom JWT secret validation** anymore. The old design that tried `CLERK_JWT_SECRET` / `NEON_JWT_SECRET` / `MONGODB_JWT_SECRET` and "validate against all templates" no longer exists in the code — signature verification is delegated to Clerk/Supabase/Convex libraries.

## Request Protection Layers

Two independent layers enforce auth:

1. **Edge middleware** (`proxy.ts`) — `clerkMiddleware` runs on every matched route. Public routes are exempted via `createRouteMatcher`; everything else calls `auth.protect()` (`proxy.ts:11-13`). Public routes today:
   - `/`
   - `/api/test-supabase-auth(.*)`
   - `/api/test-neon-auth(.*)` *(declared public, but no route handler is implemented yet)*
   - `/api/test-mongodb-auth(.*)` *(declared public, but no route handler is implemented yet)*
2. **Per-route API gate** (`validateJWTMiddleware`) — each API route re-checks auth inside its handler body. This is defense-in-depth and the canonical server-side gate.

> Note: `auth.protect()` at the edge and `validateJWTMiddleware` both ultimately call Clerk's `auth()`. A route that is public at the edge but still calls `validateJWTMiddleware` will still require a valid session (e.g. `app/api/test-supabase-auth/route.ts` is public at the edge yet uses `tryApiRoute` + `auth()` internally).

## JWT Validation Flow (Current Implementation)

```
Client Request
    ↓
proxy.ts (clerkMiddleware)
├─ isPublicRoute? -> allow (no auth.protect)
└─ else -> auth.protect()  → 401 if no session
    ↓
API route handler
    ↓
validateJWTMiddleware(request)          // lib/jwt-validate.ts
    ├─ calls Clerk auth() server-side
    ├─ extracts userId
    ├─ no userId  → 401 { success:false, error:"Not authenticated" }
    └─ userId      → { payload: { userId } }
    ↓
tryApiRoute(async () => { ... })        // utilities/apiErrorHandler.ts
    ├─ success      → 200 { success:true, data }
    └─ throws       → classifyError() → mapped status + message
```

### `validateJWTMiddleware`

Signature (note: **the `template` parameter is gone** — it no longer accepts `'clerk' | 'neon' | 'mongodb'`):

```typescript
// lib/jwt-validate.ts:11
const { payload, error } = await validateJWTMiddleware(request);

if (error) return error;   // 401 NextResponse

// payload === { userId: string }
```

It returns `JWTPayload` which is currently just `{ userId: string }` (`lib/jwt-validate.ts:5-9`). The old `extractTokenFromHeader` / `validateJWT(token, template)` helpers do **not** exist in this file anymore; do not import them.

## Unified API Error Boundary

All routes funnel their handler body through `tryApiRoute(fn, context)` (`utilities/apiErrorHandler.ts:16`). It wraps the handler in try/catch and converts thrown errors via `classifyError()` from `utilities/errorHandler.ts:19`.

`classifyError` maps errors to HTTP semantics:

| Input | Resulting status | Example trigger |
|-------|------------------|-----------------|
| `Response`/`{status}` with 400 | 400 | Bad request |
| `Response`/`{status}` with 401 | 401 | Unauthenticated / invalid token |
| `Response`/`{status}` with 403 | 403 | Forbidden (RBAC) |
| `Response`/`{status}` with 404 | 404 | Not found |
| `Response`/`{status}` with 409 | 409 | Idempotency conflict |
| `Response`/`{status}` with 422 | 422 | Validation failure (Zod) |
| `Response`/`{status}` with 429 | 429 | Rate limited |
| `Response`/`{status}` with 503 | 503 | Service unavailable |
| `Error` message contains "token"/"session"/"jwt" | 401 | Auth failures |
| `Error` message contains "forbidden"/"permission" | 403 | RBAC failures |
| `Error` message contains "not found"/"missing" | 404 | Lookup failures |
| anything else / >=500 | 500 | Server error |

Successful responses are normalized to `{ success: true, data }` (or `{ success: true }` when a handler returns nothing). A handler may also short-circuit by returning a `NextResponse` directly (treated as already-formed, passed through unchanged).

## Token Payload Structure

```typescript
// lib/jwt-validate.ts
interface JWTPayload {
  userId: string;        // Clerk userId from auth()
  email?: string;        // optional, not currently populated by validateJWTMiddleware
  [key: string]: unknown;
}
```

For Supabase/Convex the richer identity (email, subject, `tokenIdentifier`) is available from the respective SDKs, not from `validateJWTMiddleware`:
- Supabase: token minted by `getToken({ template: 'supabase' })` and injected as `Authorization: Bearer <token>` into the Supabase client (`lib/auth.ts:48-54`).
- Convex: `identity` from `ctx.auth.getUserIdentity()` exposes `subject` (= Clerk `userId`) and `tokenIdentifier` (`convex/authHelpers.ts:11`, `convex/games.ts:41`).

## Protected Routes (Actual)

| Route | Edge | API gate | Notes |
|-------|------|----------|-------|
| `/api/games` | protected | — | Served via Convex `games.list` (client-side, not this file) |
| `/api/games/[id]/patches` | protected | `validateJWTMiddleware` + `tryApiRoute` | Zod-validated JSON-Patch ops (`app/api/games/[id]/patches/route.ts:22-25`) |
| `/api/convertUrl` | protected | `validateJWTMiddleware` + `tryApiRoute` | Supabase upload + idempotency (`app/api/convertUrl/route.ts:10-13`) |
| `/api/test-supabase-auth` | **public** | `tryApiRoute` + `auth()` | Diagnostic: lists Supabase buckets (`app/api/test-supabase-auth/route.ts`) |
| `/api/push`, `/api/push/pushGames` | described in older docs but **not present in current code** | — | Verify before relying on them |

## Idempotency Key Scoping

Mutating API routes accept a caller-supplied `idempotencyKey` and wrap the work in `withIdempotency(key, fn)` (`utilities/idempotency.ts:39`). The key is stored in **Upstash Redis** (`lib/queue.ts:4-5`) under `idempotency:<key>` with a TTL of `IDEMPOTENCY_TTL_SECONDS`. Repeated calls with the same key return the cached result (`cached: true`) instead of re-executing the side effect.

- Keys are generated as UUID v7 via `generateIdempotencyKey()` (`utilities/idempotency.ts:8`).
- The `ioredis`-based implementation referenced in older docs is **gone** — the project uses Upstash Redis REST now.
- Example (`app/api/convertUrl/route.ts:34`):

```typescript
const { result, cached } = await withIdempotency(idempotencyKey, async () => {
  const buffer = Buffer.from(imageBase64, 'base64');
  const imageUrl = await uploadImage(buffer, "upload.webp", undefined, supabaseClient);
  return { url: imageUrl };
});
```

## Clerk Integration

### Token generation (frontend)
```typescript
import { useAuth } from "@clerk/nextjs";
const { getToken } = useAuth();

// Supabase-compatible token
const token = await getToken({ template: "supabase" });
```

Clerk auto-refreshes session tokens; pass `skipCache: true` to force a fresh mint when needed.

### Sign-in / Sign-up UI
- `components/authentication/login.tsx` renders a Sign-In button wired to `clerk.openSignIn({})`, wrapped in Convex's `<Unauthenticated>`.
- `components/authentication/signup.tsx` renders a Sign-Up button via `clerk.openSignUp({})`.
- `app/auth-gate.tsx` gates the app shell using Convex's `<Authenticated>` / `<Unauthenticated>` / `<AuthLoading>` primitives — shows a loading spinner, an unauthenticated overlay, or the protected children.

### Server-side Supabase client
The authenticated Supabase client is built in **`lib/auth.ts`** (the old `lib/supabase-auth.ts` is now a one-line stub that says *"replaced by lib/auth.ts"* — do not import it).

```typescript
// lib/auth.ts:38
const supabaseClient = await createAuthenticatedSupabaseClient(getToken);
```

`createAuthenticatedSupabaseClient` only supports the `supabase` service (`ServiceName = 'supabase'` at `lib/auth.ts:5`); the Neon/MongoDB service configs from older docs are **not** present. The token is pulled with `getServiceToken(getToken, 'supabase')` which throws `"Not authenticated - could not get supabase token"` if `getToken` returns null (`lib/auth.ts:30-32`).

The `hooks/useAuth.ts` hook mirrors this for the client: it builds a Supabase client from `getToken({ template: 'supabase' })` and exposes `getServiceToken('supabase')` / `refresh`.

## Supabase Auth Integration (Server-side)

`app/api/test-supabase-auth/route.ts` is the reference implementation:

```typescript
const authResult = await auth();           // @clerk/nextjs/server
const getToken = authResult.getToken;
if (!getToken) return 401;
const supabaseClient = await createAuthenticatedSupabaseClient(getToken);
const { data, error } = await supabaseClient.storage.listBuckets();
```

If the call fails, `tryApiRoute` returns `500` with a hint to check Supabase RLS policies (`app/api/test-supabase-auth/route.ts:22-27`).

## Convex Guards & Staff RBAC

### `requireAuth`
`convex/authHelpers.ts:10` throws `"Unauthenticated"` when `ctx.auth.getUserIdentity()` is null. Game mutations (`convex/games.ts:31,55,71`) call `getUserIdentity()` directly and compare `identity.tokenIdentifier` to `game.ownerId` for ownership checks (throwing `"Unauthorized"` otherwise).

### `requireStaff`
`convex/authHelpers.ts:30` enforces a minimum staff degree. It resolves the caller's degree via `api.staff.getStaffDegree` (`convex/staff.ts:6`) keyed by `clerkUserId = identity.subject`. Super Admin (degree 4) bypasses all checks; insufficient degree throws `"Forbidden"`.

### Staff degree model (`utilities/security/constants.ts:1`, mirrored in `convex/authHelpers.ts:16`)
| Degree | Role |
|--------|------|
| 0 | user |
| 1 | customerSupport |
| 2 | moderator |
| 3 | admin |
| 4 | superAdmin |

Helper functions in `utilities/security/authorize.ts`: `hasMinimumDegree`, `isStaff` (degree > 0), `getRoleLabel`. Degrees also map to role TTLs in `ROLE_TTL` (`utilities/security/constants.ts:11`) — e.g. superAdmin has `null` (no expiry), admin 6h, moderator 1d.

> Note: `convex/staff.ts` `list`/`create`/`update`/`remove` do **not** self-enforce RBAC — the auth check is expected to be done by the calling function (e.g. wrapping with `requireStaff`). Don't expose these mutations without a guard.

## Security Considerations

1. **Token storage** — Frontend never hand-rolls token storage; Clerk manages it (httpOnly session cookies). Do not log `getToken()` output.
2. **Transmission** — Always HTTPS in production; tokens ride the `Authorization` header or Clerk's cookie, never URL params.
3. **No manual secret handling** — Signature verification is delegated to Clerk/Supabase/Convex libraries. There are no `*_JWT_SECRET` env vars to set for the app itself (see env notes below).
4. **Idempotency** — All mutating endpoints require a caller-provided `idempotencyKey` backed by Redis to prevent duplicate side effects.
5. **RBAC** — Staff actions must go through `requireStaff`; ownership mutations in `games.ts` compare `tokenIdentifier`.

## Testing Authentication

### Supabase integration probe (no manual token needed)
```bash
curl http://localhost:3000/api/test-supabase-auth
# 200 when signed in & RLS allows; 401 when not signed in
```

### Authenticated request (patches)
```bash
# In the browser console, grab a Clerk session token:
const token = await getToken({ template: "supabase" });

curl -X POST http://localhost:3000/api/games/<id>/patches \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{ "patches": [ { "op": "replace", "path": "/name", "value": "New Name" } ],
        "idempotencyKey": "<uuidv7>" }'
```

### Negative cases
```bash
# Missing token -> 401 from validateJWTMiddleware
curl http://localhost:3000/api/games/<id>/patches -X POST -H "Content-Type: application/json" -d '{}'

# Invalid token -> 401
curl -H "Authorization: Bearer invalid.token.here" http://localhost:3000/api/games/<id>/patches -X POST
```

## Environment Variables (Current)

The app does **not** need `CLERK_JWT_SECRET`, `NEON_JWT_SECRET`, or `MONGODB_JWT_SECRET` (those are stale references from the old hand-rolled validator). Required today:

```env
# Clerk (standard Next.js keys; Clerk verifies signatures itself)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Convex (Clerk JWKS provider domain is hard-coded in convex/auth.config.ts)
# (Convex deployment env set via `npx convex env`)

# Supabase (used by lib/auth.ts + hooks/useAuth.ts)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

# Upstash Redis (idempotency + queue) — replaces any prior ioredis setup
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

You must also configure the **`supabase` JWT template** in the Clerk dashboard so `getToken({ template: "supabase" })` mints a token Supabase accepts, and ensure the Clerk → Convex provider (`convex/auth.config.ts`) matches your Clerk frontend API domain.

## Troubleshooting

### "Not authenticated" (401)
- Not signed in / Clerk session expired.
- Route calls `validateJWTMiddleware` but edge middleware left it public while the handler still requires `auth()` (e.g. `test-supabase-auth` returns 401 when `getToken` is null).
- Check `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` are set.

### "Not authenticated - could not get supabase token"
- `getToken({ template: "supabase" })` returned null — user not signed in, or the **`supabase` JWT template is not configured** in Clerk (`lib/auth.ts:30`).

### Still getting 401 on a route that should be open
- The route is in the `isPublicRoute` matcher in `proxy.ts` **but** still calls `validateJWTMiddleware`/`auth()` internally. Either remove the internal gate or move the route out of the public matcher.

### Supabase call fails with RLS / 500
- `test-supabase-auth` returns 500 with `"check Supabase RLS policies"` — the Clerk-issued JWT isn't authorized by Supabase row/column policies (`app/api/test-supabase-auth/route.ts:22-27`).

### Idempotency not deduplicating
- Key must be passed by the client as `idempotencyKey`; confirm `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are reachable (`utilities/idempotency.ts`). The old `ioredis` connection string is obsolete.

### Token "malformed" / "invalid JWT" messages
- These come from `classifyError` mapping on message text (`utilities/errorHandler.ts:179`), not from a manual validator. Ensure you're sending a real Clerk token, not a hand-crafted one, and that the correct JWT template is used for the target service.
