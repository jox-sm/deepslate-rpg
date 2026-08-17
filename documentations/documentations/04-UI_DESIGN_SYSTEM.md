# UI Design System

## Overview

Deepslate Dungeons has a mature, live design system built around a dark-fantasy
**Stone/Slate + Torchlight** aesthetic (the earlier abyss-purple + ember concept was
retired — see `app/globals.css`). Styling follows a strict **hybrid pattern**: **CSS
Modules own structural/layout styles**, while **Tailwind v4 utility classes — applied
through the `cn()` helper from `lib/utils.ts` — handle variants, one-off utilities,
responsiveness, and state**.

> **Rule of thumb:** never use *pure* CSS Modules without Tailwind, and never use
> *pure* Tailwind without a CSS Module for structural work. The convention is always
> `cn(styles.structuralClass, "tailwind-utility", condition && styles.variantClass)`.

---

## Design Tokens

Defined in `app/globals.css` via the Tailwind v4 `@theme` block (`app/globals.css:3`).
Every token becomes a CSS variable (`var(--color-*)`) usable from CSS Modules and a
Tailwind class (e.g. `bg-bg-surface`, `text-text-primary`, `border-border`).

### Base / Surface Colors (Stone & Slate)

| Token | Value | Semantic alias | Usage |
|-------|-------|----------------|-------|
| `--color-charcoal-950` | `#1a1510` | `--color-bg-base` | Deepest page background |
| `--color-charcoal-900` | `#24201a` | `--color-bg-surface` | Card / panel surface |
| `--color-charcoal-850` | `#2e2820` | `--color-bg-elevated` | Elevated surface |
| `--color-slate-800` | `#3a3428` | `--color-bg-hover` | Hover / glass base |
| `--color-slate-700` | `#4a4438` | `--color-border-light` | Light borders |
| `--color-slate-600` | `#5a5248` | `--color-border` | Default borders |
| `--color-slate-500` | `#6a6258` | — | Subtle divider |
| `--color-stone-dust-400/300/200` | `#8a8278`/`#9a9288`/`#aaa298` | — | Runic-silver text tints |

### Accent Colors (Torchlight & Gold)

| Token | Value | Semantic alias | Usage |
|-------|-------|----------------|-------|
| `--color-torch-600` | `#a67c52` | — | Dark torch accent |
| `--color-torch-500` | `#c9985a` | `--color-accent-muted` | Muted accent |
| `--color-torch-400` | `#d4a574` | `--color-accent` | **Primary accent** |
| `--color-torch-300` | `#e8b896` | `--color-accent-hover` | Accent hover |
| `--color-torch-200` | `#f0cba8` | — | Light accent |
| `--color-gold-600/500/400/300` | `#9a7f3f`/`#b39956`/`#c9a961`/`#ddb968` | — | Legendary / gold glow |

### Status Colors

| Token | Value | Semantic alias | Usage |
|-------|-------|----------------|-------|
| `--color-blood-600/500/400` | `#6b1f14`/`#8b2e1f`/`#ab3d2a` | `--color-destructive` (`-hover`) | Danger / destructive |
| `--color-success` | `#4a8b6f` | — | Success toast/state |
| `--color-warning` | `#c9a961` | — | Warning toast/state |
| `--color-info` | `#6b8f9a` | — | Info state |

### Text Colors (Runic Silver)

```
--color-text-primary   → #e8e6e0
--color-text-secondary → #c0bbb2
--color-text-muted     → #8a8278
```

### Typography

Configured in `app/layout.tsx:9` via `next/font/google` and exposed as CSS variables
in the `@theme` block (`app/globals.css:59`).

| Font | Variable | Weights | Usage |
|------|----------|---------|-------|
| Cormorant Garamond | `--font-display` | 400–700 (normal + italic) | Headings, hero text, card titles |
| DM Sans | `--font-sans` | 300–600 | Body text, UI, labels |

`h1`–`h4` automatically use `--font-display` with a torch-tinted text shadow
(`app/globals.css:102`).

### Motion

`--ease-ember: cubic-bezier(0.22, 1, 0.36, 1)` (`app/globals.css:64`) — used by the
`transition-all duration-200 ease-ember` pattern repeated across components.

---

## Effects & Utilities

Declared in `@layer utilities` in `app/globals.css`. Key classes:

**Glow (torch-inspired, `app/globals.css:178`):**
- `.glow-accent` — `--glow-accent` (24px + 48px torch halo)
- `.glow-accent-sm` — `--glow-accent-sm` (16px torch halo)
- `.glow-torch` — `--glow-torch` (stronger torch halo)
- `.glow-gold` / `.glow-blood` — gold / blood-red halos
- `.glow-accent-text` — ember text-shadow

**Glass / Parchment (`app/globals.css:203`):**
- `.bg-glass` — `--glass-bg` (slate-800 @ 75% + `backdrop-filter: blur(12px)`)
- `.bg-glass-torch` — glass with inset torch glow
- `.bg-parchment` — warm gradient fill

**Gradient Text (`app/globals.css:150`):**
- `.text-gradient` — torch-300 → torch-400 → gold-400
- `.text-gradient-accent` — gold-400 → torch-400 → torch-300
- `.text-gradient-gold` — gold-400 → gold-300 → torch-300
- `.text-gradient-blood` — blood-600 → blood-500 → blood-400

**Stone / Carved / Border:**
- `.stone-carved` / `.stone-embossed` — carved text shadows
- `.border-gradient` / `.border-torch` / `.border-gold` — accent borders
- `.dungeon-card` — reusable elevated card surface (slate border, torch inset glow)
- `.ornate-corners` / `.vignette` / `.texture-stone` — decorative dungeon flourishes

**Layout / Background:**
- `.container-page` — `max-width: 1440px`, responsive clamp padding (`app/globals.css:136`)
- `.bg-grid` — 40px grid pattern
- `.bg-gradient-radial-accent` / `.bg-gradient-torch` — radial torch glows

**Animations:** `fade-in`, `slide-up`, `pulse-glow`, `torch-flicker`, `shimmer`,
`runic-glow`, `stone-dust`, plus `.animate-torch-flicker` / `.animate-runic-glow`.

The `body` background uses layered radial gradients (torch + slate) over
`--color-bg-base` (`app/globals.css:87`).

---

## Styling Architecture

### The Hybrid `cn()` Pattern

Every component imports its CSS Module for structure and composes Tailwind utilities
via `cn()` (clsx + tailwind-merge, `lib/utils.ts:4`). Examples grounded in the
codebase:

```tsx
// components/adventures/cards/cards.tsx:38
<div className={cn(styles.card)} role="button" ...>

// components/game/CharacterTabs.tsx:24
<div className={cn(
  "group overflow-hidden rounded-lg border border-border bg-bg-surface",
  "transition-all duration-200 ease-ember hover:border-accent/30",
  "hover:shadow-md hover:shadow-accent/5"
)}>

// components/game/GameHeader.tsx:60
<button className="rounded-lg border border-border bg-glass px-6 py-3 ...">
```

- **CSS Modules** (`styles/`) own structural layout, the `var(--color-*)` palette,
  animations, and component-scoped geometry.
- **Tailwind** handles responsive variants, hover/focus/active states, spacing, and
  one-off overrides.
- **`cn()`** de-duplicates conflicting classes (e.g. a Tailwind `bg-*` beats a
  module background).

### Module Structure (actual files)

```
styles/
├── pages/            — home, inventory page layouts
├── layout/           — root layout backgrounds
├── cards/
│   ├── cards.module.css        — card gradient bg, image container, tag pills
│   ├── CardsGrid.module.css    — CSS-columns masonry layout, loader, exhausted
│   └── CardsLoad.module.css    — skeleton shimmer, error state
├── forms/            — game creation form + wizard step indicators
├── sidebar/
│   └── sidebar.module.css      — sticky sidebar, collapse states
├── authentication/    — unauthenticated overlay, gradient buttons
├── auth/             — signup / auth-status
└── shared/
    └── fitted-image.module.css — image wrapper, fit modes, gradient overlay
```

---

## UI Primitives (`ui/primitives/`)

Reusable building blocks. Most are Tailwind + `cn()` (no CSS Modules) so they can be
dropped anywhere; `Card*` leans on the `.dungeon-card` and gradient-text utilities.

| File | Purpose |
|------|---------|
| `button.tsx` | `Button` via `cva`. Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, **`gradient`** (torch gradient + glow), **`glass`** (`.bg-glass`), **`torch`**, **`gold`**, **`blood`**. Sizes: `default`/`sm`/`lg`/`icon`. |
| `card.tsx` | `Card` (`.dungeon-card`), `CardHeader`, `CardTitle` (`.font-display .text-gradient-gold .stone-embossed`), `CardDescription`, `CardContent`, `CardFooter`. |
| `input.tsx` | Styled input: slate border/bg, `focus-visible:border-torch-400` + `.glow-torch`. |
| `textarea.tsx` | Same treatment as `input`. |
| `label.tsx` | `text-text-secondary` label. |
| `toast.tsx` | Radix Toast primitives (`ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction`) with 4 variants: `default`, `success`, `error`, `warning`. |
| `error-page-shell.tsx` | Shared error layout, `role="alert"`, radial accent backdrop, title/message + primary (`gradient`) / secondary (`glass`) actions. |

---

## Component Architecture

### Root Layout

`app/layout.tsx:27` mounts the fonts, `ClerkProvider`, `ConvexClientProvider`,
`AuthGate`, then a flex shell: sticky `Sbar` (sidebar) + `<main className="flex-1
overflow-x-hidden">`. Pages wrap content in `.container-page` (see `app/page.tsx:5`).

### Sidebar (sticky, collapsible, glass)

- `components/background/slidebar.tsx` — the real implementation. Sticky
  `<aside class="flex h-screen flex-col">` with `styles.sidebar`, collapses to an
  icon rail by default (`useState(true)`), renders nav `Link`s from `usePathname`,
  active state via `styles.active`, and a Clerk `UserButton` footer.
- Two thin wrappers feed it items: `components/background/sidebar/sidebar.tsx`
  (`Sbar`, logo **"Hollow Depths"**, Home/Inventory/Settings/Profile) and
  `components/background/profilemenu.tsx` (`ProfileMenu`, identical items).
- Glass + collapse animation come from `styles/sidebar/sidebar.module.css`; the
  "glass" look is reinforced by `.bg-glass` utilities elsewhere.

### Cards Grid (CSS Columns masonry)

`components/adventures/cards/` — `cards-grid-wrapper.tsx` → `cards-grid.tsx`
(infinite scroll, `sessionStorage` cache, loader/exhausted states) → `cards.tsx`
(`ProfileCard`). Uses **CSS Columns, not CSS Grid** (`styles/cards/CardsGrid.module.css:2`):
`column-count: 3` (lg) → `2` (≤1024px) → `1` (≤640px), with
`break-inside: avoid` + `margin-bottom` per `cardWrapper`.

Card structure (`cards.tsx`):
```
[Card .card — gradient bg, rounded, border]
├── [Image — aspect 3/2, FittedImage, showOverlay]
├── [Name — h3 .name, line-clamp-1]  + LikeButton
└── [Tags — .tagsSection, .tagPill "#tag" pills]
```
`LikeButton` (`components/adventures/cards/like-button.tsx`) toggles via
`useLikesStore` and stops click propagation.

### Game Page Components (live UI)

All confirmed present in `components/game/` and rendered by the game route:

| Component | Role |
|-----------|------|
| `GameHeader.tsx` | Hero: `FittedImage` (1/1) + `.text-gradient` title, `LikeButton`, tag pills, glass "Share" button. |
| `CharacterTabs.tsx` | Responsive grid of characters (2/3 cols), each with `FittedImage`. |
| `ItemGrid.tsx` | Grid of items (2/4/5 cols) with `FittedImage`. |
| `MapList.tsx` | Stacked map cards (16/9 `FittedImage`, size/locations meta, "Explore Map" CTA). |
| `PlayScreen.tsx` | RPG chat client: message log, input form, autosave/restore, exit modal. |
| `ScenarioEntry.tsx` | Scenario picker entry. |
| `PlayGate.tsx` | Gate/guard for the play experience. |

These reuse the same primitives (`FittedImage`, `bg-glass`, `border-border`,
`ease-ember` transitions, `accent` tokens).

### Image Handling

`components/shared/FittedImage.tsx:17` wraps `next/image` (`fill`) with:
- `aspectRatio` (default `"4/3"`), applied via inline style.
- `fit`: `"cover" | "contain" | "fill"` → module classes (`styles.cover`/`.contain`/`.fill`).
- `showOverlay` → `styles.overlay` gradient overlay.
- `priority` / `quality` (default 85) passed through.

### Error & Notification System

```
exceptions/
├── errorPages/              — Importable, theme-aware error components (all use ErrorPageShell)
│   ├── not-found.tsx        (404)
│   ├── server-error.tsx     (500)
│   ├── forbidden.tsx        (403)
│   ├── service-unavailable.tsx (503)
│   ├── bad-request.tsx      (400)
│   ├── general-error.tsx
│   └── redis-hotness-cache.tsx  (Redis cache degraded state)
└── (notifications live under ui/notifications/, see below)
```

### Toast System (Radix)

- `ui/primitives/toast.tsx` — Radix primitives + 4 variants.
- `ui/notifications/use-toast.ts` — `useToast()` hook, `toast()`, `successToast()`,
  `errorToast()`, `warningToast()`; auto-dismiss 5s, `TOAST_LIMIT = 5`.
- `ui/notifications/toaster.tsx` — drop-in `<Toaster />`.
- `ui/notifications/index.ts` — barrel re-export.

> Note: the `exceptions/notifications/success.tsx` file referenced in older docs no
> longer exists — success/notification helpers are consolidated in `ui/notifications/`.

---

## Gradient Usage Patterns (current tokens)

### Card Background Gradients
```css
background:
  linear-gradient(160deg, var(--color-charcoal-900), var(--color-charcoal-850), var(--color-charcoal-800));
```

### Tags Section / Pill Gradients
```css
/* tag pill — cards.module.css */
background: color-mix(in srgb, var(--color-torch-400) 10%, var(--color-charcoal-900));
```

### Auth / CTA Button Gradients
```css
/* gradient button — button.tsx */
background: linear-gradient(to right, var(--color-torch-500), var(--color-torch-400));
/* glass button — .bg-glass */
background: var(--glass-bg); backdrop-filter: blur(12px);
```

### Text Gradients
```css
/* Hero / logo — .text-gradient */
background: linear-gradient(135deg, var(--color-torch-300), var(--color-torch-400), var(--color-gold-400));
-webkit-background-clip: text; -webkit-text-fill-color: transparent;

/* Card title — .text-gradient-gold */
background: linear-gradient(135deg, var(--color-gold-400), var(--color-gold-300), var(--color-torch-300));
```

### Body Background
```css
/* app/globals.css:90 */
background-image:
  radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--color-torch-400) 8%, transparent) 0%, transparent 100%),
  radial-gradient(ellipse 60% 40% at 80% 100%, color-mix(in srgb, var(--color-slate-700) 8%, transparent) 0%, transparent 100%);
```

---

## File Locations

| Path | Description |
|------|-------------|
| `app/globals.css` | Design tokens, utilities, animations (Stone/Slate + Torchlight theme) |
| `app/layout.tsx` | Font config (Cormorant Garamond + DM Sans), root layout |
| `lib/utils.ts` | `cn()` (clsx + tailwind-merge) |
| `styles/*.module.css` | CSS module files (structural styles) |
| `ui/primitives/` | Button, Card, Input, Textarea, Label, Toast, ErrorPageShell |
| `ui/notifications/` | Toast system (`use-toast`, `toaster`, `index`) |
| `exceptions/errorPages/` | 404/500/403/503/400/general/redis error components |
| `components/background/slidebar.tsx` | Sticky collapsible glass sidebar |
| `components/background/sidebar/sidebar.tsx`, `components/background/profilemenu.tsx` | Sidebar item wrappers |
| `components/adventures/cards/` | Cards grid + `ProfileCard` + `LikeButton` |
| `components/game/` | GameHeader, CharacterTabs, ItemGrid, MapList, PlayScreen, ScenarioEntry, PlayGate |
| `components/shared/FittedImage.tsx` | `next/image` wrapper |
| `types/cards.ts`, `types/gamePage.ts` | Card / game-page type definitions |
