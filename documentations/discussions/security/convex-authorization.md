### 1. Convex Functions Have No Authentication Guards

**Severity:** CRITICAL
**Location:** `convex/games.ts`, `convex/characters.ts`, `convex/maps.ts`, `convex/items.ts`
**Status:** 🔶 Acknowledged — not actionable until production launch

**Description:**
All Convex query and mutation handlers use plain `query()` / `mutation()` with no `ctx.auth.getUserIdentity()` check. The `auth.config.ts` is configured with Clerk but no handler enforces identity. Any client that can reach the Convex deployment URL can call all functions.

**Impact:** All 17 Convex functions (create, update, delete across games/characters/maps/items + list/get) have zero access control. Anyone with the deployment URL can read, create, modify, or destroy all data. No authentication required, no role gate, no ownership check. If this reaches production, it's a full data breach + data loss vector.

**Architecture Note:**
The `games.ts` file already has a broken import on line 2:
```typescript
import { authenticatedQuery, authenticatedMutation } from "./_generated/server";
```
`authenticatedQuery` and `authenticatedMutation` **do not exist** in Convex's generated server module. This would be a build error. The correct Convex pattern is plain `query`/`mutation` with `ctx.auth.getUserIdentity()` inside the handler (see [Convex auth guidelines](convex/_generated/ai/guidelines.md)).

### Correct Remediation (for when auth is needed)

#### Convex's Actual Auth API
Convex does **not** have `authenticatedQuery` / `authenticatedMutation`. The correct pattern:

```typescript
import { query, mutation } from "./_generated/server";

export const create = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    // ... actual logic
  },
});
```

#### Steps (defer until pre-launch)

1. **Fix games.ts import** — Remove the broken `authenticatedQuery, authenticatedMutation` import on line 2, use plain `query, mutation` like the other files.

2. **Add `ownerId` to schema** — None of the Convex tables (`games`, `characters`, `maps`, `items`) have an `ownerId` field. Add it before implementing ownership checks:
   ```typescript
   // schema.ts
   games: defineTable({
     name: v.string(),
     description: v.string(),
     image: v.optional(v.string()),
     tags: v.array(v.string()),
     likesCount: v.number(),
     ownerId: v.string(),         // identity.tokenIdentifier
   }),
   ```

3. **Add auth checks to mutations** — Only `create`, `update`, `remove` need auth. Public reads (`list`, `get`) can stay open for discovery.

4. **Frontend must use `ConvexProviderWithAuth`** — Verify the client uses this instead of `ConvexProvider` so tokens are sent with requests.

5. **Scope ownership checks** — For `update`/`remove`, verify `identity.tokenIdentifier === doc.ownerId`.

### Verification Checklist (for when it's time)

- [ ] `games.ts` removes broken `authenticatedQuery`/`authenticatedMutation` import
- [ ] `ownerId` field exists on all tables needing ownership
- [ ] Mutations (`create`, `update`, `remove`) check `ctx.auth.getUserIdentity()`
- [ ] Ownership verified on `update`/`remove` via `tokenIdentifier`
- [ ] `ConvexProviderWithAuth` used on frontend
- [ ] All existing functionality preserved

---

### 2. Staff Role-Based Authorization (Convex-Backed)

**Severity:** N/A — architecture spec
**Status:** 🔲 Not implemented

#### Convex Schema

```
staff table:
  clerkUserId → staffDegree (enum)
```

Staff degrees (hierarchical, higher includes lower):

| Level | Role | Assigned | Access |
|-------|------|----------|--------|
| 0 | `user` | default | Nothing. Lowest access tier. |
| 1 | `customer-support` | assigned | User tickets — read + interact |
| 2 | `moderator` | assigned | Delete games (policy violations) |
| 3 | `admin` | assigned | Ban/unban users, assign/revoke staff roles (from applications) |
| 4 | `superadmin` | assigned | Emergency dashboards, Redis worker restart, logs, IP bans, full access, assign superadmins |

#### Session Model

- **Not browser-based.** Sessions live on Clerk (service-to-service), validated on every request via Convex's `ctx.auth.getUserIdentity()`.
- The Clerk JWT carries `subject` (user ID) — the role is **not** embedded in the token. The Convex `staff` table is the single source of truth.
- Every request hits the `staff` table to resolve the caller's role, then caches the result for the role's TTL.

#### Authorization Caching Strategy (TTL per Role)

After a successful DB validation, the role is cached to avoid hammering Convex on every request. Each role has a different TTL based on how quickly privilege changes need to propagate:

| Role | Cache TTL | Rationale |
|------|-----------|-----------|
| `user` | no cache | Fast path — immediately denied at layer 1 |
| `customer-support` | 3 days | Low-risk, slow-changing assignments |
| `moderator` | 24 hours | Moderate risk, 1 req/s rate limit on deletes |
| `admin` | 6 hours | High privilege, changes need reasonable propagation |
| `superadmin` | no cache | Validated on every login via Convex |

#### Per-Role Rules

**customer-support**
- Can read and interact with user tickets only
- Role cached for 3 days before re-validation from DB
- No rate limit beyond standard API limits

**moderator**
- Can delete games (bad content: sensual, policy violations)
- Role cached for 24 hours before re-validation
- **Rate limited: 1 delete per second**

**admin**
- Can ban/unban users
- Can assign/revoke staff roles (user→customer-support, moderator, admin)
- Cannot assign superadmin
- Role cached for 6 hours before re-validation
- Manages staff applications (review → approve/reject)

**superadmin**
- Emergency dashboard: restart stuck Redis workers, monitor logs
- IP bans (infrastructure-level)
- Full access to everything
- Can assign other superadmins
- Role validated on **every login** — no cache

#### Flow: Request Authorization

```
Request → ctx.auth.getUserIdentity()
  → if no identity → 401 Unauthenticated
  → query staff table by clerkUserId
    → if no record or degree=0 → 403 + cache deny for short period
    → if cached role within TTL → use cached value
    → if cached role expired → re-query DB
  → check degree ≥ required threshold
    → if below threshold → 403 Forbidden
    → if matches → execute + update cache timestamp
```

#### Cache Implementation Notes

- **Cache storage: Clerk session JWT.** The degree + validation timestamp are embedded in Clerk's session JWT as custom claims. Clerk signs the token — tamper-proof by design.
- **Why not Redis:** Avoids side-channel attacks. Redis cache is an additional attack surface (cache poisoning, misconfiguration) with no security benefit over a signed JWT claim.
- **Mechanism:** On first DB validation, write `staff_degree` and `validated_at` into Clerk's session metadata → reflected in the JWT on subsequent requests. Convex reads `identity.staff_degree` and `identity.validated_at` instead of hitting Redis.
- **TTL check:** Compare `Date.now() - validated_at < roleTTL`. If expired, re-fetch from Convex `staff` table and update the Clerk session claims.
- **For superadmin:** skip the session cache entirely — always hit Convex `staff` table on every request.

#### Implementation Sketch

```typescript
// convex/staff.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const STAFF_DEGREE = {
  user: 0,
  customerSupport: 1,
  moderator: 2,
  admin: 3,
  superAdmin: 4,
} as const;

//this is associated with clerk session
const ROLE_TTL: Record<number, number | null> = {
  0: 0,               // user — no cache needed, instant deny
  1: 3 * 86400,       // customer-support — 3 days
  2: 86400,           // moderator — 24 hours
  3: 6 * 3600,        // admin — 6 hours
  4: null,            // superadmin — no cache, validate every time
};

// Core authorization check
export const getStaffDegree = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    return staff?.degree ?? 0;
  },
});

// Auth gate wrapper
export const requireStaff = (minDegree: number) => {
  return async (ctx: any, args: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const degree = await ctx.runQuery(api.staff.getStaffDegree, {
      clerkUserId: identity.subject,
    });

    if (degree < minDegree) {
      throw new Error("SECURITY_VIOLATION: Session terminated");
    }

    return { identity, degree };
  };
};
```

#### Key Architecture Points

- **Single source of truth:** Convex `staff` table, not JWT claims, not Clerk metadata.
- **Service-to-service sessions:** Clerk handles session lifecycle. Every request authenticates via `ctx.auth.getUserIdentity()`, then authorizes via `staff` table.
- **TTL-based caching avoids DB on every call** while keeping propagation acceptable per role.
- **Superadmin always hits DB** — highest privilege, zero tolerance for stale cache.
- **`user` (degree 0) is instantly denied** at the auth gate, no DB cost.

#### Notifications & Error Handling

**Security Violation Flow (Frontend Intercept):**
When a Convex mutation throws `SECURITY_VIOLATION: Session terminated`:
- Frontend intercepts via Convex error boundary / mutation catch
- Fires `toast.errorToast("Security violation: Your session has been terminated. Please log in again.")`
- Clears all local auth state (tokens, cached user data)
- Redirects to `/login` with a query param `?reason=security_violation`
- Login page shows a warning banner explaining the forced logout

**Staff Role Change Notifications:**
When an admin/superadmin modifies a staff role:
- Assigned → user receives `toast.successToast("You've been assigned as {role}.")` on next login
- Degraded → user receives `toast.warningToast("Your staff role has been changed.")` on next request
- Removed → user receives `toast.errorToast("Your staff access has been revoked.")` then redirected to home

**Implementation:**
- Staff change mutations return a `notification` payload
- Frontend checks for notification payload after any Convex call
- The notification is stored in Clerk session metadata or a Convex `notifications` table and cleared on read

**Error Handling:**
- Clerk API failures (session revoke fails) → logged server-side, admin gets dashboard alert
- Convex staff table write fails → rollback, no session revoke attempted, logged to error monitoring
- Rate limit exceeded (moderator 1/s) → `toast.errorToast("Rate limit: please wait before deleting another game.")`

#### Role Changes (Degradation / Deletion)

When a staff member is degraded or removed:

1. **Convex DB first** — Update or delete the record in the `staff` table
2. **Revoke Clerk sessions** — Immediately invalidate all active sessions for that user via Clerk's [Revoke Session API](https://clerk.com/docs/reference/backend-api/tag/Sessions#operation/RevokeSession):
   ```
   POST /v1/sessions/{session_id}/revoke
   ```
   Or revoke all sessions for the user:
   ```
   POST /v1/users/{user_id}/revoke_sessions
   ```
3. **Result:** The user's JWT is immediately invalid. On next request, `ctx.auth.getUserIdentity()` returns null → forced re-auth. The stale cached claim in the revoked JWT is irrelevant because the session no longer exists.

This ensures the degrade/delete is atomic: DB writes first, then session kill. No window for stale permissions.

---

### 3. Existing Project Files — Security Inventory

#### Convex

| File | Relevance | Status |
|------|-----------|--------|
| `convex/schema.ts` | 4 tables (games, characters, maps, items). No `staff` table, no `ownerId` field. | Needs `staff` table added |
| `convex/games.ts` | Broken import L2 (`authenticatedQuery` doesn't exist). No auth on any function. | Fix import + add auth |
| `convex/characters.ts` | Standard `query`/`mutation` pattern. No auth. | Add auth |
| `convex/maps.ts` | Standard `query`/`mutation` pattern. No auth. | Add auth |
| `convex/items.ts` | Standard `query`/`mutation` pattern. No auth. | Add auth |
| `convex/auth.config.ts` | Clerk domain configured (`funky-goose-55.clerk.accounts.dev`). | Already correct |
| `convex/_generated/server.js` | Exports: `query`, `mutation`, `action`, `internalQuery`, `internalMutation`, `internalAction`, `httpAction` only. | No `authenticatedQuery` exists |

#### Clerk (already fully integrated)

| File | What it does |
|------|-------------|
| `proxy.ts` | `clerkMiddleware` with `auth.protect()` on all non-public routes |
| `app/convex-client-provider.tsx` | `ConvexProviderWithClerk` — bridges Clerk auth into Convex |
| `app/auth-gate.tsx` | `Authenticated`/`Unauthenticated` components for UI gating |
| `lib/jwt-validate.ts` | `auth()` from `@clerk/nextjs/server` for API route protection |
| `lib/auth.ts` | Clerk `getToken({ template })` for Supabase/Neon/MongoDB bridging |
| `hooks/useAuth.ts` | Wraps Clerk `useAuth` with Supabase client creation |

#### Existing Tools Available

| Tool | File | What it gives us |
|------|------|-----------------|
| Rate limiter | `lib/middleware/rate-limit.ts` | Bottleneck per-IP, 10 req/s. Can adapt for moderator (1 delete/sec) by keying on `userId` instead of IP |
| Error handler | `utilities/errorHandler.ts` | `classifyError()`, `tryOrError()`, `tryFetch()`, `isAuthError()`, `getErrorMessage()`. Dark fantasy themed |
| Toast notifications | `ui/notifications/` | `toast()`, `successToast()`, `errorToast()`, `warningToast()`. Auto-dismiss 5s, max 5, Radix-based |
| Retry | `lib/retry.ts` | `retry(fn, maxTries, delayMs)` |
| Idempotency | `utilities/idempotency.ts` | Redis-backed UUID v7 keys |
| API error handler | `utilities/apiErrorHandler.ts` | `handleApiRouteError()`, `tryApiRoute()` — secured error responses for API routes |

#### Known Security Gaps (documented)

| Doc | Issue |
|-----|-------|
| `documentations/discussions/security/CSRF-vulnerablity.md` | CSRF vulnerability |
| `documentations/discussions/security/idempotency-not-scoped-for-authenticated-user.md` | Idempotency keys not tied to users |
| `documentations/discussions/security/jwt-with-no-s2s-authentication.md` | Server-to-server auth gap |
| `documentations/discussions/security/no-authorization-layer.md` | Missing authorization layer |
| `documentations/discussions/security/rate-limiter-bypass.md` | Rate limiter IP header spoofing |

#### No security folder exists yet

Target structure to create:

```
utilities/security/
├── index.ts              # re-exports
├── constants.ts           # STAFF_DEGREE, ROLE_TTL
├── types.ts               # StaffDegree, StaffRecord, etc.
├── authorize.ts           # requireStaff(minDegree) gate
├── staff.ts               # Client-side staff management helpers
└── clerk.ts               # Clerk session revocation (uses CLERK_SECRET_KEY)
convex/
├── schema.ts              # + staff table definition
├── staff.ts               # getStaffDegree query, staff CRUD mutations
├── authHelpers.ts         # requireAuth(), requireStaff() wrappers
├── games.ts               # + auth on mutations
├── characters.ts          # + auth on mutations
├── maps.ts                # + auth on mutations
└── items.ts               # + auth on mutations
```

#### Dependencies (already installed, nothing to add)

| Package | Version | For |
|---------|---------|-----|
| `@clerk/nextjs` | `^7.4.1` | Clerk auth |
| `convex` | `^1.39.1` | Convex backend |
| `convex/react-clerk` | (bundled) | Convex+Clerk bridge |
| `bottleneck` | `^2.19.5` | Rate limiting (moderator 1/s) |
| `@upstash/redis` | `^1.38.0` | Redis (cache, rate limit) |
| `radix-ui` | `^1.4.3` | Toast notifications |
| `lucide-react` | `^1.14.0` | Toast icons |
| `class-variance-authority` | `^0.7.1` | Toast variants |