# Infrastructure & Deployment Issues

### [1] `.env` Contains Production Secrets With No `.env.example` Template
**Severity:** HIGH
**Location:** `D:\deepslate dungeons\.env`
**Status:** ❌ Unresolved
**Description:** The `.env` file holds raw production secrets (DB passwords, Redis tokens, API keys, JWT secrets, Supabase credentials) in plaintext. No `.env.example` file exists to document required variables for onboarding. The file also uses inconsistent naming (e.g. `supabasepassword`, `redisqueue`, `github_token` — lowercase/snake_case vs `NEXT_PUBLIC_*` convention).
**Impact:** Production credentials are at risk of being committed to git. New developers have no documented list of required environment variables. Variable naming inconsistency creates confusion.
**Suggested Remediation:** Create `.env.example` with all required keys documented and default/dummy values. Add `.env` to `.gitignore` (verify it's already there). Standardize env var naming to `UPPER_SNAKE_CASE` (e.g. `SUPABASE_PASSWORD`, `REDIS_QUEUE_URL`).

### [2] Production Dependencies Include Build-Only CLI Tools (`shadcn`, `redis-cli`)
**Severity:** MEDIUM
**Location:** `D:\deepslate dungeons\package.json:40-41`
**Status:** ❌ Unresolved
**Description:** `shadcn` (CLI for component generation) and `redis-cli` (CLI for Redis administration) are listed under `dependencies` instead of `devDependencies`. These are development/administrative tools with no runtime value.
**Impact:** Unnecessary packages installed in production deployments. Increases deployment size and potential vulnerability surface.
**Suggested Remediation:** Move `shadcn` and `redis-cli` from `dependencies` to `devDependencies`.

### [3] PostHog Not Wrapped in `<PostHogProvider>` at Root Layout
**Severity:** HIGH
**Location:** `D:\deepslate dungeons\app\layout.tsx:27-45`
**Status:** ❌ Unresolved
**Description:** `instrumentation-client.ts` calls `posthog.init()` but the root layout (`app/layout.tsx`) does not wrap children in a `<PostHogProvider>`. According to the official PostHog Next.js App Router integration, a PostHog provider must wrap the layout for `$pageview` auto-capture, feature flags, and user identification to function correctly. Currently, `posthog-js` is imported directly in `components/adventures/cards/cards.tsx` and `components/background/slidebar.tsx` as a bare module import — a pattern that works but bypasses proper provider-based reactive context.
**Impact:** Page views are not automatically captured. Feature flags won't work. User identification requires manual workarounds. The integration does not follow the documented pattern.
**Suggested Remediation:** Create a `components/PostHogProvider.tsx` client component wrapping `posthog-js` with `usePostHog()` and add it to `app/layout.tsx` inside `ClerkProvider`. Follow the pattern documented in `.agents/skills/integration-nextjs-app-router/SKILL.md`.

### [4] `babel-plugin-react-compiler` in `dependencies` Instead of `devDependencies`
**Severity:** MEDIUM
**Location:** `D:\deepslate dungeons\package.json:19`
**Status:** ❌ Unresolved
**Description:** `babel-plugin-react-compiler` is listed under `dependencies`. This is a Babel transform plugin used only at build time; it serves no purpose in production runtime.
**Impact:** Fails `next build` if the React Compiler experimental flag isn't fully configured. Unnecessary production dependency.
**Suggested Remediation:** Move `babel-plugin-react-compiler` to `devDependencies`. Verify the `reactCompiler: true` flag in `next.config.ts` works correctly with Next.js 16.2.4's React Compiler integration (the babel plugin may be redundant — Next 16 uses the compiler via swc).

### [5] `lib/queue.ts` Uses Non-Null Assertions on Env Vars With No Validation
**Severity:** HIGH
**Location:** `D:\deepslate dungeons\lib\queue.ts:4-5`
**Status:** ❌ Unresolved
**Description:** `process.env.UPSTASH_REDIS_REST_URL!` and `process.env.UPSTASH_REDIS_REST_TOKEN!` use TypeScript non-null assertions. If these environment variables are missing at runtime, the Redis client will silently connect with `undefined` values, causing opaque connection failures.
**Impact:** Hard-to-debug runtime failures in production. No early validation at startup.
**Suggested Remediation:** Add explicit validation at module boundary:
```ts
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url) throw new Error("Missing UPSTASH_REDIS_REST_URL");
if (!token) throw new Error("Missing UPSTASH_REDIS_REST_TOKEN");
const redis = new Redis({ url, token });
```

### [6] PostHog `instrumentation-client.ts` Uses Invalid `defaults` Option and Non-Null Assertion
**Severity:** MEDIUM
**Location:** `D:\deepslate dungeons\instrumentation-client.ts:3-9`
**Status:** ❌ Unresolved
**Description:** `defaults: '2026-01-30'` is not a valid PostHog init option. The `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!` uses a non-null assertion without a guard. Additionally, this file runs in the browser but there is no corresponding `instrumentation.ts` (server-side) file for server-side PostHog tracking.
**Impact:** The `defaults` option is silently ignored. Missing env var would cause a runtime error with a cryptic message. No server-side PostHog tracking capability.
**Suggested Remediation:** Remove the invalid `defaults` option. Add a null guard for `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`. Create `instrumentation.ts` (server file) with `register()` for server-side PostHog initialization.

### [7] Cache Warmup Uses `Promise.all` With No Partial Failure Handling
**Severity:** MEDIUM
**Location:** `D:\deepslate dungeons\lib\cache-warmup.ts:59`
**Status:** ❌ Unresolved
**Description:** `warmUpCache()` collects all Redis set operations into an array and runs `Promise.all(operations)`. If any single `redis.set()` call fails (e.g. transient network error), the entire warmup fails, no games are cached, and the `cachePrimed` flag is not set.
**Impact:** Cold cache on every server restart if the Redis connection experiences intermittent issues during warmup. Triggers repeated warmup attempts that all fail.
**Suggested Remediation:** Replace `Promise.all` with `Promise.allSettled` and log per-item failures. Set `cachePrimed` flag even if partial results occur, or implement a "best-effort" warmup that counts successes and only retries if below a threshold.

### [8] No `vercel.json` for Deployment Configuration
**Severity:** MEDIUM
**Location:** `D:\deepslate dungeons\` (missing file)
**Status:** ❌ Unresolved
**Description:** The project has no `vercel.json` file. While Vercel can deploy Next.js without it, missing configuration means no custom headers (CSP, security headers), no redirects/rewrites beyond what's in `next.config.ts`, no function regions, no cron jobs, and no build overrides.
**Impact:** Suboptimal Vercel deployment configuration. Missing security headers. No ability to configure function regions or memory allocations for compute-heavy API routes.
**Suggested Remediation:** Create `vercel.json` with:
- Security headers (CSP, HSTS, X-Frame-Options)
- Function configuration (memory/regions for API routes)
- Cron job configuration for cache warmup
- Rewrites for PostHog (currently in `next.config.ts` — move or consolidate)

### [9] ESLint Script Lacks Target Directory
**Severity:** LOW
**Location:** `D:\deepslate dungeons\package.json:9`
**Status:** ⚠️ Needs Review
**Description:** The `lint` script is `"eslint"` without specifying a target directory or file pattern. This means `npm run lint` will attempt to lint stdin (if piped) or fail with no input.
**Impact:** `npm run lint` does nothing useful out of the box. Developers must know to run `eslint .` manually.
**Suggested Remediation:** Change the lint script to `"eslint ."` or `"eslint . --ext .ts,.tsx"`.

### [10] Non-standard `NEXT_PUBLIC_CONVEX_URL` Missing in `.env`
**Severity:** HIGH
**Location:** `D:\deepslate dungeons\.env`
**Status:** ❌ Unresolved
**Description:** `app/convex-client-provider.tsx:8` reads `NEXT_PUBLIC_CONVEX_URL` but this variable is not present in `.env`. Convex requires `NEXT_PUBLIC_CONVEX_URL` (or `CONVEX_URL`) to connect the frontend to the Convex deployment. The env file lacks this entirely.
**Impact:** The Convex client provider will throw at module load time (`"Missing NEXT_PUBLIC_CONVEX_URL environment variable"`), breaking the entire frontend. This works in local dev if Convex injects it, but a production deployment will crash.
**Suggested Remediation:** Add `NEXT_PUBLIC_CONVEX_URL` to `.env` and `.env.example` with the production Convex deployment URL.
