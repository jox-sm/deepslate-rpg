# Monitoring & Observability Issues

### 1. No Structured Logging — 57 Raw `console.*` Calls Across 20+ Files

**Severity:** HIGH
**Location:** Multiple files (hotnessCache.ts, gameFetchPipeline.ts, db.ts, cache-warmup.ts, apiErrorHandler.ts, pull.ts, insertGameImages.ts, useIdempotentRequest.ts, useAuth.ts, auth.ts, migrate.ts, form.tsx, cards-grid.tsx, route.tsx, supabase.ts, mutation-backup.ts, GamesInsert.tsx)
**Status:** ❌ Missing
**Description:** The entire codebase uses raw `console.log`, `console.error`, and `console.warn` with ad-hoc prefix strings like `[HotnessCache]`, `[GameFetchPipeline]`, `[CacheWarmup]`, `[API ...]`, `[MutationBackup]`. There is zero structured logging — no JSON output, no log levels (info/warn/error/fatal), no correlation IDs, no request-scoped context. 57 instances of raw `console.*` calls were found across 20+ files. This makes log aggregation, searching, alerting, and debugging production issues extremely difficult. Errors are silently swallowed in empty catch blocks (e.g., `drain/route.ts:30-32`, `use-mutation-tracker.ts:95-97`) with no trace at all.
**Impact:** When a production incident occurs, engineers have no way to correlate errors across services, trace a request through the system, search logs by user ID or request ID, or set up log-based alerts. Silent error swallowing means critical failures go undetected until users report them.
**Suggested Implementation:** Replace all `console.*` calls with a structured logger:

```typescript
// lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error" | "fatal"
interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  requestId?: string
  userId?: string
  error?: { name: string; message: string; stack?: string }
  meta?: Record<string, unknown>
}

const logger = {
  info: (module: string, message: string, meta?: Record<string, unknown>) =>
    emitLog({ level: "info", module, message, meta }),
  error: (module: string, message: string, error?: unknown, meta?: Record<string, unknown>) =>
    emitLog({ level: "error", module, message, error: serializeError(error), meta }),
  warn: (module: string, message: string, meta?: Record<string, unknown>) =>
    emitLog({ level: "warn", module, message, meta }),
  debug: (module: string, message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") emitLog({ level: "debug", module, message, meta })
  },
}
```

Each API route handler should create a request-scoped logger with the request ID and user ID, passed through the call chain or via AsyncLocalStorage.

---

### 2. No Unhandled Exception / Promise Rejection Tracking

**Severity:** HIGH
**Location:** `instrumentation-client.ts:3` (PostHog init), no global error handlers
**Status:** ⚠️ Partial
**Description:** PostHog is initialized with `capture_exceptions: true` which captures some automatic errors, but there are zero manual handlers for `window.onerror` or `unhandledrejection` anywhere in the client code. The server side has no equivalent — `tryApiRoute` (apiErrorHandler.ts:16-29) catches and formats errors but never reports them to any external monitoring service. Errors in background operations (e.g., `processBatch()` in gameFetchPipeline.ts:63-163, `cacheHit()` in hotnessCache.ts:135-189, `drainLikes()`/`drainGames()` in pull.ts) are caught, logged to console, and silently swallowed — never sent to PostHog, Sentry, or any error tracking service. Console.error in `useAuth.ts:54` and `cards-grid.tsx:67` are fire-and-forget with no reporting.
**Impact:** Unhandled promise rejections in the browser crash the rendering pipeline silently. Server-side background failures (cache warm-up, drain, batch processing) fail without alerting the team. Errors in user sessions are invisible to developers until users report broken functionality.
**Suggested Implementation:**

```typescript
// lib/errorReporter.ts - Client-side
export function initClientErrorReporting() {
  window.onerror = (message, source, lineno, colno, error) => {
    posthog.capture("$exception", {
      message,
      source,
      lineno,
      colno,
      stack: error?.stack,
    })
  }
  window.onunhandledrejection = (event) => {
    posthog.capture("$exception", {
      message: event.reason?.message ?? String(event.reason),
      stack: event.reason?.stack,
      type: "unhandledrejection",
    })
  }
}

// Server-side in apiErrorHandler.ts
export async function tryApiRoute<T>(fn: () => Promise<T>, context: string): Promise<Response> {
  const startTime = Date.now()
  try {
    const data = await fn()
    monitor.apiLatency(context, Date.now() - startTime, "success")
    if (data instanceof Response) return data
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const duration = Date.now() - startTime
    monitor.apiLatency(context, duration, "error")
    monitor.errorReport(err, context, { duration })
    return handleApiRouteError(err, context)
  }
}
```

---

### 3. No API Response Time / Performance Instrumentation

**Severity:** MEDIUM
**Location:** `utilities/apiErrorHandler.ts:16-29` (tryApiRoute), `lib/db.ts` (all DB functions), `utilities/gameFetchPipeline.ts` (all functions), `lib/cache-warmup.ts:24-68` (warmUpCache)
**Status:** ❌ Missing
**Description:** No API route or database function measures or reports execution time. `tryApiRoute` (apiErrorHandler.ts:16-29) wraps every API handler but captures zero timing data. Database functions like `getGameById`, `getGamesPaginated`, `insertGame` (db.ts) use `retry()` but never record how long queries take. The batch game fetch pipeline (gameFetchPipeline.ts) and cache warm-up (cache-warmup.ts) log messages but not durations. Redis operations (queue.ts, cache-warmup.ts, hotnessCache.ts) are entirely untimed. There is no way to detect slow queries, cache thundering herd, or API latency regressions.
**Impact:** Performance regressions go unnoticed until users complain. The team cannot set up latency alerts, identify slow database queries, or measure the impact of caching changes. No baseline exists for performance optimization work.
**Suggested Implementation:**

```typescript
// lib/monitor.ts
export const monitor = {
  apiLatency: (route: string, durationMs: number, status: "success" | "error") => {
    posthog.capture("api_latency", { route, durationMs, status })
    if (process.env.NODE_ENV === "production") {
      logger.info("api", `${route} took ${durationMs}ms`, { route, durationMs, status })
    }
  },
  dbQueryLatency: (query: string, durationMs: number) => {
    posthog.capture("db_query_latency", { query: query.slice(0, 100), durationMs })
  },
  cacheLatency: (operation: string, durationMs: number, cacheType: string) => {
    posthog.capture("cache_latency", { operation, durationMs, cacheType })
  },
}

// Wrapper for DB queries
export async function monitoredQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    monitor.dbQueryLatency(label, Date.now() - start)
    return result
  } catch (err) {
    monitor.dbQueryLatency(label, Date.now() - start)
    throw err
  }
}
```

---

### 4. No Business Metrics / User Action Tracking

**Severity:** MEDIUM
**Location:** `instrumentation-client.ts:3` (PostHog init), 4 manual `posthog.capture()` calls total
**Status:** ⚠️ Partial
**Description:** PostHog is initialized and configured with event ingestion, but only 4 manual events are captured in the entire application: `adventure_card_viewed` (cards.tsx:26), `adventure_card_clicked` (cards.tsx:31), `sidebar_toggled` (slidebar.tsx:53), and `navigation_item_clicked` (slidebar.tsx:72). There is zero tracking of: game creation, game page views, like button clicks, search usage, form submissions (success/failure rates), auth events (login/signup), error rates by page, cache hit/miss rates, API usage by route, user retention, feature adoption, or conversion funnels. The like button (community 8) and mutation tracker (community 7) are entirely un-instrumented.
**Impact:** The team has no data-driven understanding of how users interact with the application. Product decisions are made without evidence. ROI of features cannot be measured. User experience issues cannot be identified from behavioral data.
**Suggested Implementation:** Create a centralized analytics module and instrument key user flows:

```typescript
// lib/analytics.ts
export const analytics = {
  gameCreated: (gameId: string) =>
    posthog.capture("game_created", { gameId }),
  gameViewed: (gameId: string, source: "card" | "direct" | "search") =>
    posthog.capture("game_viewed", { gameId, source }),
  gameLiked: (gameId: string, action: "like" | "unlike") =>
    posthog.capture("game_liked", { gameId, action }),
  mutationSaved: (gameId: string, patchCount: number, success: boolean) =>
    posthog.capture("mutation_saved", { gameId, patchCount, success }),
  formSubmitted: (step: string, success: boolean, errorCategory?: string) =>
    posthog.capture("form_submitted", { step, success, errorCategory }),
  errorOccurred: (context: string, category: string, severity: string) =>
    posthog.capture("error_occurred", { context, category, severity }),
  cacheHit: (cacheType: string, hit: boolean) =>
    posthog.capture("cache_hit", { cacheType, hit }),
}
```

---

### 5. `tryOrErrorSync` Skips Toast Notification — Inconsistent Error UX

**Severity:** MEDIUM
**Location:** `utilities/errorHandler.ts:414-426`
**Status:** ❌ Missing
**Description:** The synchronous error handler `tryOrErrorSync()` (line 414) does NOT call `showToastFor()`, unlike its async counterpart `tryOrError()` (line 361) which does (line 382). This means any synchronous operation that fails (e.g., JSON.parse, localStorage access, synchronous data processing) will silently fail without notifying the user via toast. The function returns `showToast: false` and `toastVariant: "error"` in the result object, but callers are expected to handle this themselves — and none of the 4 call sites (gameFetchPipeline.ts:81, gameFetchPipeline.ts:181, cache-warmup.ts:79) actually check `showToast` or fire a toast.
**Impact:** Synchronous errors in the game fetch pipeline (JSON parse failures) and cache layer are completely invisible to the user. Data may silently fail to load without any feedback. This creates a degraded UX where users see empty states or stale data without understanding why.
**Suggested Implementation:**

```typescript
// utilities/errorHandler.ts
export function tryOrErrorSync<T>(
  fn: () => T,
  options: ExceptionOptions = {},
): ExceptionResult<T> {
  try {
    const data = fn()
    return { data, error: null, ErrorComponent: null, errorProps: {}, showToast: false, toastTitle: "", toastVariant: "success", ok: true }
  } catch (err) {
    const classified = classifyError(err, options.context)
    showToastFor(classified, options)
    const { Component, props } = mapToComponent(classified, options)
    return { data: null, error: classified, ErrorComponent: Component, errorProps: props, showToast: true, toastTitle: toastConfigMap[classified.category].title, toastDescription: options.fallbackMessage || classified.message, toastVariant: toastConfigMap[classified.category].variant, ok: false }
  }
}
```

Or alternatively, ensure all callers handle the `showToast` flag:

```typescript
// In gameFetchPipeline.ts line 81:
const result = tryOrErrorSync(() => JSON.parse(json), { context: "parseFetchRequest" });
if (!result.ok) {
  warningToast("Parse error", result.error?.message)
}
```

---

### 6. Mutation Tracker Silent Failure — Save Errors Are Invisible

**Severity:** MEDIUM
**Location:** `hooks/use-mutation-tracker.ts:95-97`
**Status:** ❌ Missing
**Description:** The `save()` function in `useMutationTracker` has a bare `catch` block (line 95) that returns `{ success: false }` with zero side effects — no toast, no console error, no posthog event, no retry. When patch application fails (network error, server error, validation error), the user sees nothing. The `patches` array remains dirty (not cleared), but no feedback is provided. The caller receives `{ success: false }` but the hook's API does not expose this through any observable UI mechanism. Similarly, `backupPatches` (mutation-backup.ts:10) and `clearBackup` (mutation-backup.ts:30) have empty catch blocks that only `console.warn` with no user feedback.
**Impact:** Users can lose work silently. A failed save means all pending mutations (characters, maps, items edits) are queued but never persisted. The user may navigate away thinking changes were saved, only to find them lost. Without any toast notification, the user has zero indication of failure.
**Suggested Implementation:**

```typescript
// hooks/use-mutation-tracker.ts
const save = useCallback(async () => {
  if (patchesRef.current.length === 0) return { success: true }
  setSaving(true)
  try {
    const idempotencyKey = uuidv7()
    const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/patches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-idempotency-key": idempotencyKey },
      body: JSON.stringify({ patches: patchesRef.current }),
    })
    const json = await res.json()
    const results: GamePatchResult[] = json.data?.results ?? []
    const allApplied = results.every((r: GamePatchResult) => r.status === "applied")
    if (allApplied) {
      setPatches([])
      clearBackup(gameId)
      successToast("Changes saved", "Your edits have been applied successfully.")
    } else {
      const errorCount = results.filter((r) => r.status === "error").length
      errorToast(`Save partially failed`, `${errorCount} of ${results.length} patches failed.`)
      posthog.capture("mutation_save_partial_failure", { gameId, errorCount, total: results.length })
    }
    setLastSaveResult(results)
    return { success: allApplied, results }
  } catch (err) {
    const classified = classifyError(err, "useMutationTracker.save")
    errorToast("Save failed", classified.message)
    posthog.capture("mutation_save_failed", { gameId, message: classified.message })
    return { success: false }
  } finally {
    setSaving(false)
  }
}, [gameId])
```

---

### 7. Drain Pipeline Errors Silently Swallowed — No Alerting Path

**Severity:** MEDIUM
**Location:** `app/api/drain/route.ts:30-32,41-43`
**Status:** ❌ Missing
**Description:** The drain route catches errors from `drainLikes()` and `drainGames()` with empty catch blocks and comments like `// error already logged in drainLikes`. While `drainLikes` and `drainGames` (pull.ts) do log to console.error, there is no mechanism to alert when drain operations fail. These are background data-flush operations that keep Redis and databases in sync — failures here cause data divergence, stale caches, and lost likes. Furthermore, the drain route is called internally from `games/route.ts` with `.catch(() => { /* drain errors are non-fatal */ })` (games/route.ts:31,38), which is doubly silent. Failed drains accumulate without any detection mechanism.
**Impact:** Likes and game data queued in Redis silently fail to flush to PostgreSQL. This means user actions (likes, game creations) appear to succeed but are eventually lost. Data divergence between Redis and PostgreSQL grows unnoticed until manual reconciliation or data loss occurs.
**Suggested Implementation:**

```typescript
// app/api/drain/route.ts
const shouldDrainLikes = force || target === "likes" || now - lastLikesDrain >= LIKES_INTERVAL_MS
if (shouldDrainLikes) {
  try {
    const likesResult = await drainLikes()
    results.likes = likesResult
    lastLikesDrain = now
    if (likesResult.processed > 0) {
      logger.info("drain", `Drained ${likesResult.processed} likes`)
      posthog.capture("drain_completed", { target: "likes", count: likesResult.processed })
    }
  } catch (err) {
    const classified = classifyError(err, "drain.likes")
    logger.error("drain", "Likes drain failed", err)
    posthog.capture("drain_failed", { target: "likes", error: classified.message })
    // Notify ops channel in production
    if (process.env.NODE_ENV === "production") {
      await fetch(process.env.OPS_WEBHOOK_URL!, {
        method: "POST",
        body: JSON.stringify({ text: `🔴 Likes drain failed: ${classified.message}` }),
      })
    }
  }
}
```

Additionally, add a health check endpoint or periodic heartbeat that monitors drain staleness:

```typescript
// app/api/health/route.ts
export async function GET() {
  const lastDrain = await redis.get("drain:last:likes")
  const staleness = Date.now() - Number(lastDrain)
  if (staleness > 60000) {
    logger.warn("health", "Likes drain overdue", { stalenessMs: staleness })
    // Trigger alert
  }
}
```

---

### 8. No Data Flow / Request Tracing — Zero Correlation IDs

**Severity:** HIGH
**Location:** All API routes, utilities, and hooks across the codebase
**Status:** ❌ Missing
**Description:** There is no request tracing mechanism anywhere in the codebase. No request IDs, no correlation IDs, no trace propagation. When a user request flows from the client → Next.js API route → Redis → PostgreSQL → MongoDB → response, there is no way to trace that specific request through the system. Errors are logged with context strings (e.g., `"GameFetchPipeline.getGameWithBatchQueue"`) but these are static strings, not request-scoped identifiers. The `tryApiRoute` wrapper catches errors but does not generate or propagate a request ID. The `classifyError` function receives a `context` string but never a trace ID. Client-side PostHog events have no correlation with server-side logs.
**Impact:** Debugging production issues requires manual correlation of timestamps across unrelated log lines. When a user reports an error, there is no way to find the corresponding server-side logs. Multi-step operations (game fetch pipeline, patch application, image upload pipeline, drain operations) cannot be traced end-to-end.
**Suggested Implementation:**

```typescript
// lib/trace.ts
let traceCounter = 0

export function generateTraceId(): string {
  return `${Date.now().toString(36)}-${(traceCounter++).toString(36)}-${crypto.randomUUID().slice(0, 8)}`
}

export function getTraceId(): string {
  return globalThis.__traceId__ ?? "no-trace"
}

// API route wrapper that injects trace ID
export async function tracedApiRoute(
  handler: (traceId: string) => Promise<Response>,
  context: string,
): Promise<Response> {
  const traceId = generateTraceId()
  globalThis.__traceId__ = traceId
  const startTime = Date.now()
  try {
    const response = await handler(traceId)
    const duration = Date.now() - startTime
    response.headers.set("X-Trace-Id", traceId)
    logger.info("api", `${context} completed`, { traceId, durationMs: duration, status: response.status })
    return response
  } catch (err) {
    logger.error("api", `${context} failed`, err, { traceId, durationMs: Date.now() - startTime })
    return handleApiRouteError(err, context)
  }
}
```

---

### 9. Cache Warm-Up and Hotness Cache Have No Monitoring

**Severity:** LOW
**Location:** `lib/cache-warmup.ts:24-68`, `utilities/hotnessCache.ts` (all functions)
**Status:** ❌ Missing
**Description:** The cache warm-up pipeline (cache-warmup.ts:24-68) and hotness cache (hotnessCache.ts) manage critical performance infrastructure but have zero monitoring. No metrics are collected for: cache hit rates, cache miss rates, promotion rates, eviction counts, warm-up success/failure, warm-up duration, hotness promotion threshold hits, cache size over time, or compression ratio. The `getCacheStats()` function in hotnessCache.ts (line 326) only returns entry count, max entries, and memory pressure — but nothing is instrumented to PostHog or any metrics system. The `checkMemoryPressure()` function (line 37) is hardcoded to always return `false` with the comment `"Upstash REST API does not expose INFO/MEMORY stats"`, meaning the entire memory-pressure guard is a no-op.
**Impact:** The team has no visibility into cache effectiveness. Promotions and evictions run blind. A cache stampede (warm-up failing → all requests hit the database) would go completely undetected. The memory-pressure guard is dead code — no actual protection exists.
**Suggested Implementation:**

```typescript
// in cache-warmup.ts warmUpCache:
const startTime = Date.now()
const success = await retry(() => getGamesPaginated(WARMUP_LIMIT, 0), 3, 1000)
const duration = Date.now() - startTime
posthog.capture("cache_warmup", {
  success: games.length > 0,
  gameCount: games.length,
  durationMs: duration,
})

// in hotnessCache.ts:
export async function getCacheStats(): Promise<CacheStats> {
  const { views } = await loadCacheState()
  const hits = views.reduce((sum, v) => sum + v.views, 0)
  return {
    entriesCount: views.length,
    maxEntries: MAX_CACHE_ENTRIES,
    totalViews: hits,
    avgViews: views.length > 0 ? Math.round(hits / views.length) : 0,
    memoryPressure: false, // no-op until Upstash exposes this
  }
}
```

---

### 10. No User Session / Auth Lifecycle Tracking

**Severity:** LOW
**Location:** `hooks/useAuth.ts:18-76`, `instrumentation-client.ts:3`
**Status:** ❌ Missing
**Description:** The `useAuth` hook (useAuth.ts) manages Clerk auth state and Supabase client creation but captures zero analytics events. There is no tracking of: successful logins, failed logins, token refresh events, session expiry, auth errors, or Supabase client initialization failures. PostHog user identification is not performed — while PostHog captures some events (card clicks, sidebar toggles), there is no `posthog.identify()` call with the user's distinct ID. This means PostHog treats every page load as a new anonymous user, making user-level analytics useless. The `CLERK_JWT_SECRET` and auth middleware in `jwt-validate.ts` catch errors but don't track auth failures to any monitoring system.
**Impact:** Auth-related issues (token expiry, session refresh failures, rate limiting on auth endpoints) are invisible. The team cannot track login success rates, identify users experiencing auth problems, or measure auth latency. PostHog dashboards show inflated unique user counts because identification is missing.
**Suggested Implementation:**

```typescript
// hooks/useAuth.ts
export function useAuth() {
  const { getToken, isLoaded, isSignedIn, userId } = useClerkAuth()

  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      posthog.identify(userId, { email: /* from Clerk */ })
      posthog.capture("auth_ready", { signedIn: true })
    }
    if (isLoaded && !isSignedIn) {
      posthog.capture("auth_ready", { signedIn: false })
    }
  }, [isLoaded, isSignedIn, userId])

  const createClients = useCallback(async () => {
    // ... existing code ...
    try {
      const supabaseToken = await getToken({ template: 'supabase' })
      if (!supabaseToken) {
        logger.warn("useAuth", "Supabase token is null", { userId })
        posthog.capture("auth_token_missing", { template: "supabase" })
      }
      // ... rest of existing code ...
    } catch (error) {
      const classified = classifyError(error, "useAuth.createClients")
      logger.error("useAuth", "Failed to create auth clients", error, { userId })
      posthog.capture("auth_client_creation_failed", {
        error: classified.message,
        category: classified.category,
      })
      setState(prev => ({ ...prev, isLoading: false, error: classified.message }))
    }
  }, [getToken, isLoaded, isSignedIn, userId])
}
```
