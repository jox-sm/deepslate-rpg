# Architecture & Code Quality Issues

### Import Cycle: `exceptions/notifications/index.ts` ↔ `exceptions/notifications/success.tsx`
**Severity:** HIGH
**Location:** `exceptions/notifications/index.ts:1` → `exceptions/notifications/success.tsx:5` → `@/ui/notifications`
**Type:** Import Cycle
**Description:** The barrel export `index.ts` re-exports `SuccessNotification`/`SuccessToastTrigger` from `./success`. The `success.tsx` component imports `successToast` from `@/ui/notifications`, creating a dependency chain through the notification layer. While not a literal 2-file cycle (success.tsx does not re-import from `./index.ts`), it creates an architectural cycle: `exceptions/notifications` (presentation) imports from `@/ui/notifications` (toast system), while its barrel also serves as a top-level API for consumers. The dependency direction suggests `success.tsx` belongs in `@/ui/notifications` rather than `exceptions/notifications`.
**Impact:** Fragile module boundary. Adding re-exports from `@/ui/notifications` into the `exceptions/notifications` barrel would create a true circular dependency. Future changes risk cascading breakage.
**Suggested Fix:** Move `SuccessNotification` and `SuccessToastTrigger` into `ui/notifications/` directory since they depend on the toast system. Remove `exceptions/notifications/` entirely and update consumers to import from `@/ui/notifications` directly.

---

### Code Duplication: Duplicate `useGamesForm` hooks
**Severity:** HIGH
**Location:** `hooks/gameForm.ts:1-138` and `lib/useGamesForm.ts:1-150`
**Type:** Code Duplication
**Description:** Two nearly identical implementations of `useGamesForm` with identical functions: `createEmptyCharacter`, `createEmptyMap`, `createEmptyItem`, step navigation, CRUD operations for characters/maps/items. Both extend `useFormState`. The `hooks/gameForm.ts` version has a broken `setForm` method that logs a warning but does nothing, while `lib/useGamesForm.ts` is the correct implementation with proper type exports and no dead code.
**Impact:** Confusion about which import to use, duplicated maintenance burden, dead code in `hooks/gameForm.ts::24-28` that silently accepts calls without effect. Bug-prone — maintainers fixing one copy may miss the other.
**Suggested Fix:** Delete `hooks/gameForm.ts`. Keep `lib/useGamesForm.ts` as the single source of truth. Update any imports of `@/hooks/gameForm` to `@/lib/useGamesForm`.

---

### Dead Code: Empty `hooks/useGameCache.ts`
**Severity:** MEDIUM
**Location:** `hooks/useGameCache.ts`
**Type:** Dead Code
**Description:** The file at `hooks/useGameCache.ts` is completely empty (0 lines), while the actual implementation lives at `utilities/clientUtilities/useGameCache.ts` which exports `useGameCache`, `useGamePreload`, and `useGamePreloadStore`. The empty file acts as a dead import target.
**Impact:** Developers may import from `@/hooks/useGameCache` expecting the hook and get `undefined`, causing runtime errors or confusing build failures. Unused file adds noise.
**Suggested Fix:** Delete `hooks/useGameCache.ts`. Add a re-export barrel if backward compatibility is needed: `export { useGameCache, useGamePreload, useGamePreloadStore } from "@/utilities/clientUtilities/useGameCache"`.

---

### Dead Code: `lib/supabase-auth.ts` stale placeholder
**Severity:** LOW
**Location:** `lib/supabase-auth.ts:1`
**Type:** Dead Code
**Description:** The entire file content is a single comment: `// This file has been replaced by lib/auth.ts`. It is never imported anywhere in the project. Leftover from a refactor.
**Impact:** Confuses developers finding the file during navigation. Adds noise to the codebase.
**Suggested Fix:** Delete `lib/supabase-auth.ts`.

---

### Code Duplication: Split image utilities across two files
**Severity:** LOW
**Location:** `utilities/imagesUtils.ts` and `utilities/clientUtilities/imagesUtils.ts`
**Type:** Code Duplication
**Description:** Server-side image utilities (`convertToWebp`, `uploadImageWithProgress`, `createUploadController`) live in `utilities/imagesUtils.ts`, while a client-only `arrayBufferToBase64` lives in `utilities/clientUtilities/imagesUtils.ts`. The naming collision (`imagesUtils.ts` in both locations) is confusing. Additionally, `lib/storage.ts:16` re-implements similar upload logic (`convertToWebp` call) creating a third overlapping utility.
**Impact:** Developers may import the wrong `imagesUtils` file. Upload logic is fragmented across 3 files (`lib/storage.ts`, `utilities/imagesUtils.ts`, `utilities/clientUtilities/imagesUtils.ts`). Hard to audit image pipeline behavior.
**Suggested Fix:** Consolidate into `utilities/images.ts` with clearly separated server/client sections or a single utilities module. Move `arrayBufferToBase64` alongside its related conversion functions.

---

### Service Coupling: Error handler imports UI components
**Severity:** MEDIUM
**Location:** `utilities/errorHandler.ts:10-16`
**Type:** Coupling
**Description:** The core error utility `utilities/errorHandler.ts` imports 6 error page components (`NotFoundErrorPage`, `ServerErrorPage`, `ForbiddenErrorPage`, `BadRequestErrorPage`, `ServiceUnavailableErrorPage`, `GeneralErrorPage`) from `@/exceptions/errorPages`. This creates a dependency from a pure utility layer into the component/UI layer. The `mapToComponent` function (line 264) then returns React component references, meaning the error handler cannot be used in non-React or server-side contexts without pulling in the full React component tree.
**Impact:** Breaks separation of concerns. Cannot tree-shake error pages effectively. Every use of `tryOrError` or `classifyError` transitively bundles all error page components. Server-side API routes using `classifyError` (e.g., `lib/db.ts:19`, `lib/jwt-validate.ts:32`) unnecessarily include React component references.
**Suggested Fix:** Split `classifyError` into a pure utility in `utilities/errorHandler.ts` and move `mapToComponent`, `showToastFor`, `tryOrError`, `tryOrErrorSync` into a new React-aware module at `exceptions/errorHandlerUI.ts` or `hooks/useErrorBoundary.ts`. Server-only code imports only `classifyError`.

---

### TypeScript Config: Missing path aliases for common directories
**Severity:** LOW
**Location:** `tsconfig.json:21-23`
**Type:** Configuration
**Description:** Only one path alias is defined: `@/*` maps to `./*`. The project uses multiple deep directory paths (`@/utilities/errorHandler`, `@/hooks/useFormState`, `@/lib/queue`). While `@/*` covers all imports, missing explicit aliases for `@hooks/`, `@lib/`, `@components/`, `@types/`, `@utilities/` means refactoring tools (IDEs, codemods) lack structured migration paths. The `lib/` directory contains `useGamesForm.ts` (a client hook), `db.ts`, `queue.ts`, `retry.ts`, `auth.ts`, `storage.ts`, etc. — mixing server, client, and isomorphic modules under one alias.
**Impact:** No strict enforceability of layer boundaries (server vs client imports). IDEs cannot provide targeted auto-completion for specific module layers. Refactoring is error-prone.
**Suggested Fix:** Add fine-grained path aliases: `"@hooks/*": ["./hooks/*"]`, `"@lib/*": ["./lib/*"]`, `"@components/*": ["./components/*"]`, `"@types/*": ["./types/*"]`, `"@utilities/*": ["./utilities/*"]`, `"@ui/*": ["./ui/*"]`. Consider an ESLint rule (`import/no-restricted-paths`) preventing `@/hooks` from importing `@/lib/db` (server-only) and vice versa.

---

### Dead Code: `lib/supabase.ts` console.logs and non-null assertions
**Severity:** MEDIUM
**Location:** `lib/supabase.ts:6-14`
**Type:** Dead Code
**Description:** `lib/supabase.ts` logs environment variable presence at module scope (`console.log("--- Supabase Connection Check ---")` etc.), emits a `console.error` on missing vars, and creates the client with non-null assertions (`supabaseUrl!`, `supabaseKey!`). The authenticated wrapper `lib/auth.ts` (`createAuthenticatedSupabaseClient`) duplicates this client creation with proper token handling. Additionally, `hooks/useAuth.ts` creates its own Supabase client inline with the same pattern.
**Impact:** Console log pollution in production builds. Multiple Supabase client creation paths (`lib/supabase.ts:14`, `lib/auth.ts:48`, `hooks/useAuth.ts:38`). Non-null assertions bypass TypeScript safety — if env vars are missing, the app crashes at runtime instead of at compile/init time.
**Suggested Fix:** Remove `lib/supabase.ts` and consolidate Supabase client creation into `lib/auth.ts`'s `createAuthenticatedSupabaseClient`. In `lib/storage.ts:20`, require the authenticated client and remove the fallback to the unauthenticated `supabase` singleton. Remove `hooks/useAuth.ts` (it duplicates `lib/auth.ts` functionality). Replace non-null assertions with early-throw or error-return patterns.
