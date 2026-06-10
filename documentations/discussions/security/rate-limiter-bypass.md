
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

