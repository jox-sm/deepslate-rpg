# Security & Authentication Issues

## New Findings (Not in 01-SECURITY_VULNERABILITIES.md)

### 1. Convex Functions Have No Authentication Guards — Full Public Access to All CRUD Operations

**Severity:** CRITICAL
**Location:** `convex/games.ts:5-83`, `convex/characters.ts:4-49`, `convex/maps.ts:4-52`, `convex/items.ts:4-46`
**Status:** ❌ Unresolved

**Description:**
All Convex query and mutation handlers across every table (games, characters, maps, items) are defined using `query()` and `mutation()` — never `authenticatedQuery()` or `authenticatedMutation()`. None of the handlers call `ctx.auth` or check `ctx.auth.userId`. While `convex/auth.config.ts` defines a Clerk provider domain, the actual functions never enforce identity. This means any unauthenticated client that can reach the Convex deployment endpoint can list, get, create, update, and delete all data.

**Impact:**
- Anonymous attackers can read all game data (names, descriptions, images, like counts)
- Anonymous attackers can create, modify, or delete games, characters, maps, and items via the Convex HTTP endpoint
- Data integrity of the entire Convex-backed dataset is compromised
- Even if Next.js API routes are protected, the Convex endpoint itself is a parallel attack surface with zero authentication

**Suggested Remediation:**
- Replace `query()` with `queryWithAuth()` wrapper (or `authenticatedQuery`) and `mutation()` with `authenticatedMutation()` in every handler
- Add `ctx.auth` check at the top of each handler:
  ```typescript
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  ```
- For user-scoped data, verify `identity.subject` matches the resource owner
- Review `convex/_generated/ai/guidelines.md` for Convex auth patterns

---

### 2. Idempotency Keys Not Scoped to Authenticated User — Cross-User Cache Replay

**Severity:** HIGH
**Location:** `utilities/idempotency.ts:39-56`
**Status:** ❌ Unresolved

**Description:**
The `withIdempotency()` function stores operation results in Redis under the key `idempotency:${key}` with no user identity binding. If user A submits a game creation with `idempotencyKey = "uuid-v7-1"`, the cached result (including game URL, success data) is stored globally. User B can send the same idempotency key and receive user A's cached response — or block user A's operation from executing by pre-registering the key.

**Impact:**
- Information disclosure: an attacker can replay an idempotency key to learn about another user's operation results
- Denial of service: an attacker can pre-register idempotency keys to prevent legitimate users from completing operations
- Violates the principle of idempotency being scoped to the requesting client

**Suggested Remediation:**
- Prefix idempotency cache keys with the user's identity: `idempotency:${userId}:${key}`
- Add the authenticated user ID as a parameter to `withIdempotency()` calls
- Verify the cached result belongs to the same user before returning it

---

### 3. No Authorization Layer — All Authenticated Users Are Equally Privileged

**Severity:** HIGH
**Location:** `lib/jwt-validate.ts:15`, `app/api/*/route.ts` (all API routes)
**Status:** ❌ Unresolved

**Description:**
The `validateJWTMiddleware()` function only checks that a user is authenticated (has a Clerk `userId`). It performs zero authorization checks — no roles, no permissions, no admin/user distinction. Every authenticated user can perform every operation: push games to the queue, drain Redis queues, patch any game's data, upload images to Supabase storage, and access all game data including private/in-progress content.

**Impact:**
- Any signed-up user can perform admin-level operations
- No way to restrict destructive operations (drain, patches) to trusted users
- In a multiplayer/RPG context, one player could modify another player's game data
- If a user account is compromised, the attacker gains full access to the entire system, not just that user's data

**Suggested Remediation:**
- Implement a role-based access control system (e.g., `admin`, `creator`, `viewer` roles)
- Add a `role` field to the user profile in the database
- Create an `authorize(userId, requiredRole)` helper that checks the user's role
- Apply authorization checks after authentication in every API route:
  ```typescript
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;
  await authorize(payload.userId, 'creator');
  ```

---

### 4. Internal Drain Calls Use User JWT With No Service-to-Service Authentication

**Severity:** HIGH
**Location:** `app/api/games/route.ts:28-38`, `app/api/drain/route.ts:12-14`
**Status:** ❌ Unresolved

**Description:**
The `maybeTriggerDrain()` function in `games/route.ts` makes internal `fetch()` calls to `/api/drain` using the authenticated user's own JWT (the fetch inherits the request cookies/headers from the user's session). The `/api/drain` endpoint only validates that the JWT is valid — it never checks whether the request came from an internal source or whether the `x-internal-drain: 1` header is present (the header is sent but never verified server-side). This means:
- The "internal" drain mechanism is just a regular authenticated API call
- Any authenticated user can call `/api/drain?force=true` to drain queues on demand
- There is no service-account token or shared-secret authentication for internal calls

**Impact:**
- Any user can force-drain database queues, potentially causing data loss or race conditions
- No audit trail distinguishing internal drain calls from user-triggered drains
- If the await/async pattern in `maybeTriggerDrain()` causes concurrent drains, the in-memory `lastLikesDrain`/`lastGamesDrain` guards can be bypassed by multiple simultaneous requests

**Suggested Remediation:**
- Add a server-side environment variable `INTERNAL_API_SECRET` for service-to-service authentication
- Check this secret on the drain route (via `x-internal-drain` header value being the hash of the secret)
- Alternatively, move drain logic to a server-only module rather than routing through an HTTP endpoint
- Log all drain operations with the requesting user ID

---

### 5. GET `/api/drain` Performs State-Changing Operations — CSRF Vulnerable

**Severity:** MEDIUM
**Location:** `app/api/drain/route.ts:12-53`
**Status:** ❌ Unresolved

**Description:**
The `/api/drain` endpoint is implemented as a `GET` handler that performs state-changing operations (draining Redis queues into PostgreSQL/MongoDB). GET requests should be idempotent and safe per HTTP semantics. Using GET for state mutation makes the endpoint trivially exploitable via cross-site request forgery (CSRF) — an attacker can trigger drain operations with an `<img>`, `<link>`, or `<script>` tag pointing to the drain URL: `<img src="https://app.com/api/drain?force=true" />`.

**Impact:**
- Any authenticated user visiting a malicious page can have their browser trigger drain operations
- Repeated force-drain requests can cause database write contention
- Combined with finding #4 (no internal auth), CSRF can drain queues on demand

**Suggested Remediation:**
- Change `/api/drain` to `POST` or `PATCH` (idempotent safe methods don't apply here, but POST is correct for state-changing operations)
- Add CSRF protection (e.g., custom header check, anti-CSRF token, or SameSite cookie enforcement)
- Move queue draining to a server-side cron or schedule rather than HTTP-triggered

---

### 6. Rate Limiter Bypass via Missing or Spoofed `x-forwarded-for` Header

**Severity:** MEDIUM
**Location:** `lib/middleware/rate-limit.ts:12-13`
**Status:** ❌ Unresolved

**Description:**
The `rateLimitMiddleware()` function keys on `x-forwarded-for` header to identify clients. If the header is absent (e.g., direct server-to-server requests, or requests through certain proxies), it falls back to the string `'unknown'`. All requests without the header converge on a single Bottleneck instance, allowing an attacker to bypass per-IP rate limiting by simply omitting the header. Additionally, the value is trivially spoofable — an attacker can rotate through arbitrary IPs.

**Impact:**
- Brute-force attacks can bypass rate limiting by omitting or rotating the `x-forwarded-for` header
- All non-proxied traffic collapses into one shared rate limit bucket
- The `queued() > 100` check on line 16 uses `Bottleneck.Group.key()` which returns a new limiter per key, but the queued check measures all queued items across all keys in the group, not per-IP — this means IP A's queued items could trigger rate limiting for IP B

**Suggested Remediation:**
- Combine `x-forwarded-for` with additional signals: `x-real-ip`, `cf-connecting-ip` (Cloudflare), or use the Vercel edge-compatible rate limiting approach
- Implement a per-IP rate limiter using Redis (sorted sets or the Upstash rate limit API) instead of Bottleneck in-process queues
- Add a fallback that uses a combination of user-agent + accept-language + other headers when IP is unavailable

---

### 7. Supabase Configuration Leaked in Production Console Output

**Severity:** LOW
**Location:** `lib/supabase.ts:6-12`
**Status:** ❌ Unresolved

**Description:**
The `lib/supabase.ts` module logs environment variable presence checks to the console at import time:
```typescript
console.log("--- Supabase Connection Check ---");
console.log("URL exists:", !!supabaseUrl);
console.log("Key exists:", !!supabaseKey);
```
These log statements execute on every cold start and in all environments (including production). While they don't log the actual secret values, they confirm which environment variables exist, giving attackers reconnaissance information about the deployment configuration.

**Impact:**
- Production console logs can be inspected via browser dev tools if the module is imported client-side (which `hooks/useAuth.ts` does)
- Reveals configuration structure and confirms attack surface (Supabase is in use)
- Violates the principle of minimal information disclosure

**Suggested Remediation:**
- Remove `console.log` statements or guard them behind `process.env.NODE_ENV !== 'production'`
- Use a proper startup validation that runs only in development or during build time
- Alternatively, use a silent validation that throws with a generic error at runtime instead of logging
