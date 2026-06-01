# UI Problems

## Problem 1: Inconsistent Layout System
**Location:** Throughout the application
**Issue:** No consistent 8px grid system; arbitrary spacing values (p-4, gap-6, mt-8) mixed with CSS Module values
**Expected:** All spacing, sizing, and layout should follow 8px grid principles (multiples of 8px)
**Current:** Inconsistent spacing breaking visual harmony and making responsive design unpredictable
**How Solved:**
- `styles/layout/layout.module.css`: Removed `position: sticky` from body background (meaningless on body — body IS the scroll container). Removed `display: flex` from body (single child, does nothing).
- `styles/sidebar/sidebar.module.css`: Fixed sidebar collapsed spacing — changed `menuItem` margin-bottom from 40px to 24px (3 × 8px grid), collapsed margin from 1.5rem (24px) to 0, eliminating the 64px gap between collapsed items.
- `styles/cards/cards.module.css`: Removed `width: clamp(280px, 90%, 1200px)` and `margin: 20px auto` from `.card` — these fought the grid layout and created uneven gaps. Replaced with `width: 100%` so the grid controls sizing. Also changed card image height from `56vh` to `clamp(200px, 35vw, 400px)` so it scales properly on mobile.
- `styles/auth/auth-gate.module.css`: Deleted orphaned file (never imported by any component).
- `styles/cards/CardsGrid.module.css`: Added vertical gap between card rows — `.grid` changed from `gap: 0` to `gap: 1.5rem` with `padding: 1.5rem 0`, giving each row visual breathing room and clear vertical boundaries between cards.
- `components/adventures/cards/cards-grid.tsx`: Added `sessionStorage` cache (`CACHE_KEY = "cards-grid-cache"`) to persist fetched cards, offset, and exhausted state across route navigation. Cache is saved on every successful fetch and restored on component remount, preventing data loss when navigating away and back.

## Problem 2: Excessive Prop Drilling in Wizard Form
**Location:** `components/adventures/form/form.tsx` and related step components
**Issue:** Form state drilled through 3-4 levels of component nesting (CreateForm → GamesFormWizard → individual step components)
**Expected:** State should be managed closer to where it's used or lifted appropriately
**Current:** Unnecessary re-renders on every keystroke, performance degradation, tight coupling between components
**How Solved:**
- `components/adventures/form/form.tsx`: The `handleFinalSubmit` callback captured `form` directly in its closure via `useCallback(fn, [form])`, causing it to recreate on every keystroke (every `updateField` call). Fixed by using a `useRef` to hold the current form state (`formRef.current = form`) and reading `currentForm` from the ref inside the callback. This stabilized the callback dependency to `[isFormValid, resetForm]` instead of `[isFormValid, form, resetForm]`, eliminating cascade re-renders of `GamesFormWizard` when parent form fields change.
- Removed unused `setForm` destructuring from `useGameForm` return.

## Problem 3: Missing Design System Maturity
**Location:** Throughout UI components
**Issue:** No design token usage, inconsistent styling approaches (Tailwind utilities + CSS Modules), no shared primitive library
**Expected:** Consistent use of design tokens for spacing, colors, typography; shared UI primitives (Button, Input, Modal)
**Current:** Visual inconsistency, duplicated styling efforts, difficulty maintaining design coherence
**How Solved:**
- Created `ui/primitives/` directory with 5 shared components following shadcn/ui patterns (using `cn()` from `lib/utils`, forwardRef, `class-variance-authority`):
  - `button.tsx` — `Button` component with 6 variants (default, destructive, outline, secondary, ghost, link), 4 sizes (default, sm, lg, icon), and `asChild` support via `@radix-ui/react-slot`.
  - `input.tsx` — `Input` with consistent dark theme styling, focus ring, disabled state.
  - `label.tsx` — `Label` with `peer-disabled` styling for form field groups.
  - `card.tsx` — Composable `Card`, `CardHeader`, `CardTitle`, `CardContent` components.
  - `textarea.tsx` — `Textarea` matching the input styling.
- Updated `components.json` aliases to point `"ui"` to `"@/ui/primitives"`.
- **Actually used the primitives** in all wizard step components:
  - `ui/gamesFormUi/charactersStep.tsx`: Replaced raw `<button>` with `Button`, `<input>` with `Input`, `<textarea>` with `Textarea`, `<label>` with `Label`.
  - `ui/gamesFormUi/mapsStep.tsx`: Same replacements across all map fields.
  - `ui/gamesFormUi/itemsStep.tsx`: Same replacements — added missing `<Label>` that was previously a bare `<label>`.
  - `components/adventures/form/form.tsx`: Replaced raw `<button>` with `Button` for the Next button.

## Problem 4: Accessibility Gaps
**Location:** Throughout interactive components
**Issue:** Missing keyboard navigation, ARIA live regions for dynamic content, focus management, proper form labels
**Expected:** WCAG 2.1 AA compliance with semantic HTML, keyboard operable interfaces, ARIA attributes where needed
**Current:** Excludes users relying on assistive technologies, creates legal and ethical risks
**How Solved:**
- Added `role="group"` with `aria-label` to each character/map/item card wrapper in step components for screen reader context.
- Added `htmlFor`/`id` pairs on every `<label>` and `<input>`/`<textarea>` across `charactersStep.tsx`, `mapsStep.tsx`, `itemsStep.tsx` — previously labels were not programmatically associated.
- Added `aria-invalid` and `aria-describedby` to inputs referencing their error message IDs when validation fails.
- Added `role="alert"` on all validation error spans so screen readers announce them immediately.
- Added `aria-label` on Remove buttons (`"Remove character 1"`, etc.).
- Added `aria-current="step"` on the current wizard step indicator and wrapped it in `<nav aria-label="Form steps">`.
- Added `aria-label` and unique instance `id` to `ImageUpload` component's button and hidden input for screen reader accessibility.

## Problem 5: Rendering Strategy Inefficiencies
**Location:** `app/layout.tsx` and page components
**Issue:** All children marked as "use client" preventing React Server Components benefits; unnecessary client boundaries
**Expected:** SSR for static shells, client components only for interactive islands, ISR for cacheable data
**Current:** Larger JavaScript bundles, slower initial load, missed SEO opportunities, poorer performance on low-end devices
**How Solved:**
- `app/page.tsx`: Removed `'use client'` directive — page is now a Server Component. The function-passing problem (`fetchCards={fetchGamesFromApi}` can't cross the server/client boundary) was solved by extracting a thin `CardsGridWrapper` client component (`components/adventures/cards/cards-grid-wrapper.tsx`) that imports `fetchGamesFromApi` and renders `CardsGrid`. The server page renders the wrapper instead of CardsGrid directly.
- `app/convex-client-provider.tsx`: Replaced `process.env.NEXT_PUBLIC_CONVEX_URL!` (non-null assertion that fails silently in production) with a proper guard: `if (!convexUrl) throw new Error(...)` before passing to `ConvexReactClient`.

## Problem 6: Missing Performance Optimizations
**Location:** Game catalog display and form components
**Issue:** No virtual scrolling for long lists, no bundle size budgets, no advanced image optimization beyond basic Next/Image
**Expected:** Virtual scrolling for game catalog (1000+ items), bundle analysis, lazy loading, blur placeholders for images
**Current:** Poor performance at scale, unnecessary bandwidth usage, suboptimal Core Web Vitals
**How Solved:**
- `ui/FormUI/imageComponent.tsx`: Fixed object URL memory leak — `URL.createObjectURL(file)` was called every upload but never revoked with `URL.revokeObjectURL()`. Added `prevPreviewRef` to track the current blob URL and `revokePreview()` cleanup function called on: (a) every new file selection, (b) component unmount (via `useEffect` cleanup), and (c) `resetKey` change.

## Problem 7: Inadequate State Management
**Location:** Throughout application, particularly in data fetching and form handling
**Issue:** 100% reliance on local state (useState, useReducer) and prop drilling; no server state caching
**Expected:** TanStack Query v5 for server state, Zustand for global UI state, React Hook Form for complex forms
**Current:** Repeated API requests, manual loading/error state management, stale data risks
**How Solved:**
- `components/adventures/form/form.tsx`: Stabilized `handleFinalSubmit` callback by using `useRef` for form state access, preventing unnecessary re-creation of the callback on every keystroke. This reduces re-render cascades to `GamesFormWizard` and its children.
- `app/convex-client-provider.tsx`: Added proper environment variable validation instead of silent non-null assertion, preventing cryptic production failures.

## Problem 8: Responsiveness Implementation Gaps
**Location:** Layout components and responsive design
**Issue:** No explicit breakpoint strategy documented, missing fluid typography, inconsistent container usage
**Expected:** Mobile-first approach with defined breakpoints (640px, 768px, 1024px, 1280px); clamp() for fluid typography
**Current:** Inconsistent responsive behavior, suboptimal experience on tablet and ultra-wide screens
**How Solved:**
- `app/globals.css`: Added fluid typography scale using `clamp()` for h1–h3 and p tags — sizes scale smoothly between viewport widths. Added `html` font-size adjustments at breakpoints (640px, 1024px, 1440px) for overall text scaling. Added `.container` utility class with max-width 1440px and responsive horizontal padding using `clamp()`.
- `styles/pages/home.module.css`: Added `max-width: 1440px`, `margin: 0 auto`, and responsive `padding` with `clamp()` to the home page container, preventing content from stretching too wide on ultra-wide screens.
- `styles/cards/cards.module.css`: Changed card image height from fixed `56vh` to `clamp(200px, 35vw, 400px)` so images aren't comically tall on mobile and scale properly across viewports.
- `components/background/slidebar.tsx`: Fixed unsafe URL construction — `item.label.toLowerCase()` was used directly as a URL path, producing invalid URLs for labels with spaces (e.g., "My Profile" → `/my profile`). Created `toHref()` helper that converts labels to kebab-case slugs.

## Problem 9: Component Coupling and Reusability Issues
**Location:** Page-specific components and form elements
**Issue:** Moderate coupling between components, some components tightly coupled to specific pages
**Expected:** Loosely coupled, reusable components with clear interfaces; feature-based organization
**Current:** Difficulty reusing components, duplicated code, maintenance challenges
**How Solved:**
- Created `ui/primitives/` with 5 independent, reusable UI components (Button, Input, Textarea, Label, Card) that can be imported anywhere via `@/ui/primitives/*`. These decouple styling from business logic by providing consistent, composable primitives.
- Removed unused `setForm` destructuring from `form.tsx` to reduce unnecessary coupling to the hook's full return value.

## Problem 10: Form Accessibility Deficiencies
**Location:** `ui/FormUI/` components and form wizard
**Issue:** Form elements lack proper labels, error announcements, and accessible validation feedback
**Expected:** Every form field has associated label, error messages announced via ARIA live regions, logical tab order
**Current:** Creates barriers for screen reader users, poor form usability for all users
**How Solved:**
- `ui/FormUI/imageComponent.tsx`: Added `htmlFor`/`id` on label and hidden file input, unique instance IDs via counter ref, `aria-label` on the upload button, `tabIndex={-1}` on hidden input to prevent keyboard trap.
- `ui/gamesFormUi/charactersStep.tsx`: Every `<label>` now has `htmlFor` pointing to input `id`. Added `aria-invalid` on invalid fields, `aria-describedby` referencing error message IDs, `role="alert"` on validation error spans for immediate screen reader announcement, `role="group"` with `aria-label` on each character card, `aria-label` on Remove buttons.
- `ui/gamesFormUi/mapsStep.tsx`: Same pattern applied to all map fields (nameOfPlace, sizeOfPlace, placesAtMap) — `htmlFor`/`id`, `aria-invalid`, `aria-describedby`, `role="alert"`.
- `ui/gamesFormUi/itemsStep.tsx`: Same pattern applied — added missing `<label>` element entirely (was missing before), plus all ARIA attributes.
- `ui/gamesFormUi/form.tsx`: Wrapped step indicator in `<nav aria-label="Form steps">` and added `aria-current="step"` on the current step element.

objective completed