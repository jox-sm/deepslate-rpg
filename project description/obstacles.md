# Obstacles & Troubles Faced

## 1. Convex Agent Skills Split Across Two Directories

**Problem:** Skills were split between `.claude/skills/` and `.agents/skills/` — some skills only existed in one location (e.g., `integration-nextjs-app-router` was only in `.claude/skills/`, `neon-postgres` only in `.agents/skills/`). The convex-setup-auth skill couldn't be loaded after `.claude/skills/` was deleted because the tool expected it there.

**Fix:** Consolidated everything into `.agents/skills/` and removed `.claude/skills/`. Updated `AGENTS.md` and `CLAUDE.md` to point to the centralized location.

---

## 2. `npx convex ai-files install` Overwrote CLAUDE.md

**Problem:** Running `npx convex ai-files install` wrote its own section to `CLAUDE.md`, wiping out my custom edits (the `.agents/skills/` reference I had added).

**Fix:** Re-added the missing line after the install completed. This is a managed file — any custom edits outside the `<!-- convex-ai-start -->` / `<!-- convex-ai-end -->` block get preserved, but edits inside that block get overwritten.

---

## 3. Agent Skills Install Failed on Windows (libcurl-4.dll)

**Problem:** `npx skills add get-convex/agent-skills` failed with `fatal: failed to load library 'libcurl-4.dll'` — a Git HTTPS transport issue specific to Windows.

**Fix:** The skills were already installed via the lock file. The `npx convex ai-files install` command succeeded for the AI guidelines despite this error.

---

## 4. Clerk Package Confusion

**Problem:** `package.json` listed `"clerk": "^1.4.0"` which is the Clerk CLI tool, NOT the frontend SDK. The actual packages needed (`@clerk/nextjs`, `@clerk/react`) weren't installed.

**Fix:** Installed `@clerk/nextjs` which pulled in `@clerk/react` and `@clerk/shared` as dependencies.

---

## 5. Clerk `SignInButton` / `SignUpButton` Custom Children Not Reliable

**Problem:** Passing custom `<button>` children to Clerk's `<SignInButton>` / `<SignUpButton>` components didn't produce reliable styling — Clerk sometimes rendered its own default button alongside or the custom styling didn't apply properly.

**Fix:** Switched to using Clerk's `useClerk()` hook directly: `clerk.openSignIn({})` and `clerk.openSignUp({})` on plain `<button>` elements. This gives full control over button rendering and eliminates Clerk's default UI.

---

## 6. Convex `auth.config.ts` Key Mismatch

**Problem:** The `auth.config.ts` `providers[].domain` key was accidentally written as `CLERK_FRONTEND_API_URL` instead of `domain`. Convex silently ignored the invalid key, resulting in "No auth provider found matching the given token (no providers configured)".

**Fix:** Corrected the key from `CLERK_FRONTEND_API_URL` to `domain`.

---

## 7. Convex `auth.config.ts` Not Pushed to Deployment

**Problem:** Even after fixing the key, Convex still reported "no providers configured" because the file change hadn't been pushed to the Convex dev deployment. The file is evaluated server-side, not at build time.

**Fix:** Ran `npx convex dev --once` to push the current `convex/` code to the dev deployment, which made the auth provider live.

---

## 8. Clerk "single-session mode" Blocking Modals

**Problem:** Clicking Sign In / Sign Up threw `cannot_render_single_session_enabled` because the user was already signed in with Clerk but Convex didn't recognize it (due to the missing auth.config.ts). Clerk prevents opening sign-in/sign-up modals when a session already exists.

**Fix:** The proper fix requires: (a) configuring the Clerk Convex integration at `https://dashboard.clerk.com/apps/setup/convex`, (b) signing out completely, (c) signing back in to get a fresh JWT with the correct audience claim.

---

## 9. Convex `Unauthenticated` Renders When Clerk Is Signed In

**Problem:** After fixing `auth.config.ts`, Convex's `<Unauthenticated>` component still rendered because the user's existing Clerk session token didn't have the `aud: "convex"` claim — only tokens minted after activating the Convex integration have it.

**Fix:** The user must sign out completely and sign back in. The old session's token is stale — only a fresh sign-in generates a Convex-compatible token.

---

## 10. `UserProfile` Route Not a Catch-All

**Problem:** Clerk's `<UserProfile />` component requires a catch-all route (`[[...rest]]/page.tsx`), but it was mounted at a plain `page.tsx`. Clerk threw a runtime error about the route not being configured correctly.

**Fix:** Converted `app/profile/page.tsx` to `app/profile/[[...rest]]/page.tsx`.

---

## 11. Auth Overlay Was Rendering Page Content Behind It

**Problem:** The auth gate initially rendered `{children}` (sidebar + games content) first, then overlayed the blur on top with `fixed inset-0`. The user didn't want the site content rendered at all — just the auth screen.

**Fix:** Restructured `AuthGate` to use:
```
<Unauthenticated> → AuthScreen (no children)
<Authenticated> → children (full site)
```
So when unauthenticated, absolutely zero page content renders.

---

## 12. Sidebar AuthStatus Duplicating Buttons

**Problem:** The sidebar footer had an `AuthStatus` component that also rendered Sign In / Sign Up buttons via its own `<Unauthenticated>` wrapper. When the auth gate overlay was supposed to block the page, these buttons appeared at the bottom of the sidebar.

**Fix:** Removed `<AuthStatus />` from the sidebar footer entirely. Auth UI is now exclusively handled by the layout-level `AuthGate`.

---

## 13. Auth-Gate Z-Index Stacking Issues

**Problem:** The fixed overlay didn't always cover all elements due to stacking contexts created by parent elements with `transform`, `z-index`, or `position` properties.

**Fix:** Used `z-[9999]` (very high z-index) on the overlay and ensured no parent created a new stacking context that would clip it.

---

## 14. Next.js App Router Learning Curve

**Problem:** The project uses Next.js 16 which has breaking changes from previous versions. The standard mental model for Next.js patterns (layouts, metadata, server components, client boundaries) doesn't always apply.

**Fix:** Read `node_modules/next/dist/docs/` before writing any Next.js code as instructed in `AGENTS.md`.

---

## 15. Convex Guidelines Not Followed Initially

**Problem:** Early Convex code used `.filter()` (slow table scan), `.collect()` (unbounded), and some functions without validators. The Convex AI guidelines in `convex/_generated/ai/guidelines.md` prohibit these patterns.

**Fix:** Refactored to use `.withIndex()`, `.take(n)` / `.paginate()`, and added validators to all functions. The guidelines are now treated as the authoritative reference for Convex code.
