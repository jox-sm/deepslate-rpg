
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
