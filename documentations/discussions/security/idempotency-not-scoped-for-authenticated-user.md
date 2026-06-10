
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
