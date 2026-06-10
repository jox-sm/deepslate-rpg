
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
