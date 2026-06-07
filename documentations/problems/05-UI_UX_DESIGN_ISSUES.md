# UI/UX & Design System Issues

### [1] Undefined Color Tokens Referenced Across CSS Modules

**Severity:** HIGH
**Location:**
- `styles/auth/auth-status.module.css:38,45` — uses `--color-abyss-600`, `--color-ember-500`
- `styles/authentication/unauthenticated.module.css:27,62,68,86` — uses `--color-ember-*` tokens
- `styles/auth/signup.module.css:3` — uses `--color-ember-500`
- `styles/auth/login.module.css` — uses `--color-ember-500`
- `app/globals.css:130-132` — scrollbar styles reference `--color-abyss-950`, `--color-abyss-600`, `--color-abyss-500`
- `styles/cards/CardsLoad.module.css:12` — references `--color-abyss-600`
- `styles/forms/wizard.module.css:28` — references `--color-abyss-600`
**Status:** ❌ Unresolved
**Description:** The `@theme` in `globals.css` defines colors under `--color-charcoal-*`, `--color-slate-*`, `--color-torch-*`, `--color-gold-*`, `--color-blood-*` namespaces. However, numerous CSS modules reference `--color-ember-*` (ember-500, ember-400, ember-300, ember-200) and `--color-abyss-*` (abyss-950, abyss-600, abyss-500) which **do not exist** in the design token definitions. These are either leftover tokens from a previous theme iteration or typos. The CSS silently degrades, rendering default/inherited colors instead of the intended torchlight palette.
**Impact:** Auth buttons, scrollbars, wizard step indicators, and skeleton loaders render in the wrong colors. This creates visual inconsistency and degrades the dark fantasy aesthetic.
**Suggested Fix:** Add the missing tokens to `@theme` in `globals.css`:
```css
--color-ember-600: #a67c52;
--color-ember-500: #c9985a;
--color-ember-400: #d4a574;
--color-ember-300: #e8b896;
--color-ember-200: #f0cba8;
--color-abyss-950: #1a1510;
--color-abyss-900: #24201a;
--color-abyss-600: #5a5248;
--color-abyss-500: #6a6258;
```

---

### [2] Duplicate Sidebar Wrappers — ProfileMenu and Sbar Are Identical

**Severity:** MEDIUM
**Location:**
- `components/background/sidebar/sidebar.tsx` (Sbar — imported by `app/layout.tsx`)
- `components/background/profilemenu.tsx` (ProfileMenu — never imported)
**Status:** ❌ Unresolved
**Description:** Both `profilemenu.tsx` and `sidebar/sidebar.tsx` are identical wrapper components that render the same `Sidebar` component from `slidebar.tsx` with the same logo "Hollow Depths" and the same menu items (Home, Inventory, Settings, Profile). `ProfileMenu` is defined but never imported anywhere in the codebase — it is dead code. This is confirmed by the graph report: "Sidebar consumers - ProfileMenu and Sbar are identical wrappers consuming Sidebar component."
**Impact:** Unnecessary code duplication that wastes bundle size and creates maintenance confusion. A developer could modify one and not the other.
**Suggested Fix:** Delete `components/background/profilemenu.tsx`. Remove the dead import chain. If a named export is needed elsewhere, export from `sidebar/sidebar.tsx` instead.

---

### [3] No CSS Grid / 8px Baseline Alignment in Layout System

**Severity:** MEDIUM
**Location:**
- `styles/cards/CardsGrid.module.css:3,5,10` — `column-gap: 1.25rem` (20px), `padding: 1.5rem` (24px), `margin-bottom: 1.25rem` (20px)
- `styles/sidebar/sidebar.module.css:93-94` — `padding: 8px` on menu, `margin-bottom: 24px` on item
- `styles/forms/form.module.css:8,16,17,20` — `padding: 24px`, `gap: 20px`, mix of 24/20
- `styles/cards/cards.module.css:39,63` — `padding: 10px 14px 4px` (arbitrary), `padding: 8px 14px 10px` (arbitrary)
- `styles/shared/fitted-image.module.css` — no spacing tokens used
**Status:** ❌ Unresolved
**Description:** Despite the project's CLAUDE.md claiming "8px Grid System", spacing values across CSS modules are inconsistent. The CardsGrid uses 20px gaps and 24px padding; sidebar items use 24px bottom margins; card sections use 10px/14px/4px arbitrary values. No file uses a consistent 8px increment scale. There is no `--spacing-*` token system defined in the `@theme` for layout spacing. The design claims 8px grid but nothing enforces it.
**Impact:** Visual rhythm is inconsistent. Padding and gaps shift unpredictably between components. The "8px grid" claim in AGENTS.md is false advertising for the current codebase.
**Suggested Fix:** Define spacing tokens in `globals.css` `@theme`:
```css
--spacing-1: 8px;
--spacing-2: 16px;
--spacing-3: 24px;
--spacing-4: 32px;
--spacing-5: 40px;
```
Then audit all CSS modules to replace raw values with these tokens. Card sections should use `--spacing-1` or `--spacing-2` multiples.

---

### [4] No `prefers-reduced-motion` Respect for Animations

**Severity:** HIGH
**Location:**
- `app/globals.css:336-394` — all `@keyframes` (fade-in, slide-up, pulse-glow, torch-flicker, shimmer, runic-glow, stone-dust, animate-torch-flicker, animate-runic-glow)
- `styles/cards/CardsGrid.module.css:40-48` — bounce animation on loader dots
- `styles/cards/CardsLoad.module.css:19-21` — shimmer animation on skeleton
- `styles/cards/cards.module.css:13` — `transition: all 0.3s ease`
**Status:** ❌ Unresolved
**Description:** None of the CSS animations or transitions wrap their values in a `@media (prefers-reduced-motion: reduce)` query. Users with vestibular motion disorders who enable "Reduce motion" in their OS will still see pulsing, flickering, bouncing, and shimmering animations. The torch-flicker and pulse-glow animations are particularly aggressive for sensitive users. The project uses `scroll-behavior: smooth` on `html` which also lacks a reduced-motion guard.
**Impact:** Violates WCAG 2.1 Success Criterion 2.3.3 (Animation from Interactions). Excludes users with vestibular disorders. Legal risk for accessibility compliance.
**Suggested Fix:** Add a reduced-motion block:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

### [5] No Error Boundary in Component Tree

**Severity:** HIGH
**Location:**
- `app/layout.tsx:27-46` — Root layout wraps children in `ClerkProvider` > `ConvexClientProvider` > `AuthGate` > `<main>`, but no React Error Boundary exists at any level
- `exceptions/errorPages/*.tsx` — Error page components exist but are never wired into a boundary
**Status:** ❌ Unresolved
**Description:** The entire app has no React Error Boundary. If any component throws during render (e.g., a Convex subscription fails, a hook errors out), the entire page will white-screen with no recovery UI. The project imports `ErrorPageShell` and has dedicated error page components (`NotFoundErrorPage`, `ServerErrorPage`, `GeneralErrorPage`) but none are connected via error boundaries at the layout or page level.
**Impact:** A single runtime error in any component crashes the full page with a white screen. The user sees a Next.js default error or blank page. No retry or fallback UI is offered.
**Suggested Fix:** Add an `<ErrorBoundary>` at the layout level (wrapping `<AuthGate>`) and a per-page boundary. Use the existing `GeneralErrorPage` component as fallback:
```tsx
import { GeneralErrorPage } from "@/exceptions/errorPages";

// In layout:
<ErrorBoundary FallbackComponent={GeneralErrorPageFallback}>
  <AuthGate>...</AuthGate>
</ErrorBoundary>
```

---

### [6] ProfileCard Used as Button Lacks Accessible Name

**Severity:** HIGH
**Location:** `components/adventures/cards/cards.tsx:36-42`
**Status:** ❌ Unresolved
**Description:** The `ProfileCard` component has `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler for Enter, but **no `aria-label`** or `aria-describedby` to give screen readers context about the action. A screen reader will announce something like "button" with no indication that clicking navigates to the game detail page. The `FittedImage` inside the card has a valid `alt` attribute, but the button wrapper itself has no label.
**Impact:** Screen reader users hear "button" without knowing what it does or where it navigates. This violates WCAG 4.1.2 (Name, Role, Value).
**Suggested Fix:** Add `aria-label` to the card div:
```tsx
<div
  onClick={handleClick}
  role="button"
  tabIndex={0}
  aria-label={`View adventure: ${name}`}
  onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
>
```

---

### [7] UnauthenticatedOverlay Has No Focus Trap

**Severity:** HIGH
**Location:** `components/authentication/unauthenticated.tsx:13-42`
**Status:** ❌ Unresolved
**Description:** The `UnauthenticatedOverlay` is a full-screen fixed overlay (`position: fixed; inset: 0; z-index: 100`) that blocks interaction with the main content. However, it implements **no focus trap**. A keyboard user can Tab beyond the overlay's two buttons, losing focus to the browser chrome or — worse — tabbing to interactive elements underneath the overlay (which remain in the DOM and focusable). The `AuthGate` renders both the `<Unauthenticated>` and `<Authenticated>` branches simultaneously; the authenticated content is still in the DOM behind the overlay.
**Impact:** Keyboard and screen reader users can interact with content hidden behind the overlay. Severely impacts accessibility (WCAG 2.4.3 Focus Order). Also a UX predictability issue.
**Suggested Fix:** Use a focus-trapping library (e.g., Radix UI's `FocusTrap` or a simple custom `useFocusTrap` hook) to cycle focus within the two buttons. Additionally, set `aria-hidden="true"` on the authenticated content when unauthenticated.

---

### [8] Orphaned CSS Module — CardsLoad.module.css Not Imported

**Severity:** LOW
**Location:** `styles/cards/CardsLoad.module.css` (35 lines, never imported in any component)
**Status:** ❌ Unresolved
**Description:** The file `styles/cards/CardsLoad.module.css` defines skeleton loading styles (`skeleton`, `cardWrapper`, `error`, shimmer animation, and responsive breakpoints). A grep across the project reveals it is **never imported** by any `.tsx` file. The skeleton loader in `CardsGrid` uses inline `<span>` dots with inline styles instead of this ready-made skeleton component.
**Impact:** 35 lines of dead CSS in the bundle. The loading state for the card grid uses a custom inline loader that is inconsistent with the skeleton design defined in this module.
**Suggested Fix:** Either wire `CardsLoad.module.css` into `CardsGrid` to replace the inline dot animation with the skeleton component it was designed for, or delete the file and the inline loader if a simpler approach is preferred.

---

### [9] Contrast Ratio Deficiency on Link/Secondary Buttons

**Severity:** MEDIUM
**Location:**
- `ui/primitives/button.tsx:18` — `ghost` variant: `text-text-secondary` on hover `text-text-primary`
- `ui/primitives/button.tsx:20` — `link` variant: `text-accent`
- `components/authentication/auth-status.tsx:24` — Sign In button: no explicit text color (inherits from `--color-text-secondary`)
**Status:** ❌ Unresolved
**Description:** The `ghost` button variant uses `text-secondary` (`#c0bbb2` on `--color-charcoal-900` background = `#24201a`). The calculated contrast ratio is approximately 7.5:1 for the inactive state, which passes, but on hover it does not ensure sufficient contrast against hover backgrounds. The `link` variant's `text-accent` (`--color-torch-400` = `#d4a574`) on `--color-bg-surface` (`#24201a`) provides a ratio of roughly 6.2:1 — borderline for small text, but the variant is meant for inline links within paragraphs, where size varies.
**Impact:** Some users with low vision may struggle to distinguish ghost/link buttons from body text, especially on lower-quality displays. WCAG 2.1 requires 4.5:1 for small text; while these pass, the link variant is indistinguishable from the accent color used in decorative borders and glows.
**Suggested Fix:** Add `underline` to the link variant permanently (not just on hover). For ghost, add a subtle focus ring or border differentiation (not just color alone). Use `aria-current="page"` for contextual differentiation.

---

### [10] Inline Animation Values Bypass Design System

**Severity:** LOW
**Location:** `components/adventures/cards/cards-grid.tsx:126`
**Status:** ❌ Unresolved
**Description:** The CardsGrid loader dots use inline `style` attribute with `animationDelay: \`${i * 150}ms\`` to stagger the bounce animation. This is a hardcoded value that bypasses the design system's `ease-ember` custom easing, cannot be adjusted globally for all loaders, and cannot be disabled via a single CSS custom property for reduced-motion preferences.
**Impact:** Minor maintainability concern. If the design system's animation timing is updated centrally, this inline value will be missed.
**Suggested Fix:** Define a CSS custom property for loader delays in the animation class, or use CSS `nth-child` selectors (already partially done in `CardsGrid.module.css:32-38`) to handle the delays entirely in CSS. Remove the inline `style` prop.
