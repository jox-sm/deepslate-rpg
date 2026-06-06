# UI Design System

## Overview

Dark fantasy RPG-themed design system with an abyss-purple + ember-glow palette. Styling uses a hybrid approach: **CSS Modules for structural/layout styles** + **Tailwind v4 utility classes via `cn()` for variants and overrides**.

---

## Design Tokens

Defined in `app/globals.css` via Tailwind v4 `@theme` block. Custom CSS properties accessible both from Tailwind classes (`bg-bg-surface`, `text-text-primary`) and CSS modules (`var(--color-bg-surface)`).

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-abyss-950` | `#050308` | Deepest bg |
| `--color-abyss-900` | `#0a0714` | Surface bg |
| `--color-abyss-850` | `#0f0b1e` | Elevated bg |
| `--color-abyss-800` | `#161128` | Hover state |
| `--color-abyss-700` | `#201a36` | Borders |
| `--color-abyss-600` | `#2d2550` | Light borders |
| `--color-abyss-500` | `#3f3470` | Subtle accents |
| `--color-ember-600` | `#cc3f00` | Dark accent |
| `--color-ember-500` | `#e85510` | Muted accent |
| `--color-ember-400` | `#ff6b24` | Primary accent |
| `--color-ember-300` | `#ff8c4a` | Accent hover |
| `--color-ember-200` | `#ffad78` | Light accent |

### Semantic Aliases

```
--color-bg-base       → abyss-950
--color-bg-surface    → abyss-900
--color-bg-elevated   → abyss-850
--color-bg-hover      → abyss-700
--color-text-primary  → #f0ecf4
--color-text-secondary → #c8c0dc
--color-text-muted    → #7a7090
--color-border        → abyss-700
--color-border-light  → abyss-600
--color-accent        → ember-400
--color-accent-hover  → ember-300
--color-accent-muted  → ember-500
```

### Typography

| Font | Variable | Weight Range | Usage |
|------|----------|-------------|-------|
| Cormorant Garamond | `--font-display` | 400-700 | Headings, hero text |
| DM Sans | `--font-sans` | 300-600 | Body text, UI |

### Effects

- **Glass:** `background: var(--glass-bg); backdrop-filter: blur(12px)` — sidebar, auth buttons
- **Glow:** `box-shadow: var(--glow-accent)` — 20px + 60px ember glow
- **Glow sm:** `box-shadow: var(--glow-accent-sm)` — 12px ember glow
- **Gradient text:** `.text-gradient` — ember-300/400/200 linear gradient
- **Gradient accent text:** `.text-gradient-accent` — lighter ember variant

### Utilities

Classes in `@layer utilities` in `app/globals.css`:
- `.container-page` — max-width 1440px + responsive padding
- `.text-gradient` / `.text-gradient-accent` — gradient text fills
- `.glow-accent` / `.glow-accent-sm` — ember glow box-shadows
- `.glow-accent-text` — ember text shadow
- `.bg-glass` — frosted glass effect
- `.bg-grid` — grid pattern overlay
- `.bg-gradient-radial-accent` — radial ember gradient

---

## Styling Architecture

### CSS Modules + cn() Pattern

All component files follow this pattern:

```tsx
import { cn } from "@/lib/utils";
import styles from "@/styles/xxx/xxx.module.css";

<div className={cn(styles.structuralClass, "tailwind-utility", condition && styles.variantClass)}>
```

- **CSS Modules** (`styles/`) own the structural layout, semantic colors via `var(--color-*)`, and animations
- **Tailwind** handles one-off utilities, responsive variants, hover/focus states
- **`cn()`** (clsx + tailwind-merge) resolves conflicts correctly

### Module Structure

```
styles/
├── pages/
│   ├── home.module.css          — Home page layout
│   └── inventory.module.css     — Inventory page layout
├── layout/
│   └── layout.module.css        — Root layout backgrounds
├── cards/
│   ├── cards.module.css         — Card gradient bg, image layout, tags gradient
│   ├── CardsGrid.module.css     — Column layout (CSS columns), loader, exhausted
│   └── CardsLoad.module.css     — Skeleton shimmer, error state
├── forms/
│   ├── form.module.css          — Game creation form wrapper, inputs, tags
│   └── wizard.module.css        — Multi-step wizard step indicator
├── sidebar/
│   └── sidebar.module.css       — Sticky sidebar, glass bg, collapse states
├── authentication/
│   └── unauthenticated.module.css — Auth overlay, gradient buttons
├── auth/
│   ├── signup.module.css        — Gradient sign-up button
│   └── auth-status.module.css   — Auth status loading/unauthenticated
└── shared/
    └── fitted-image.module.css  — Image wrapper, fit modes, gradient overlay
```

### UI Primitives (`ui/primitives/`)

Direct Tailwind + cn() components (no CSS modules) — reusable building blocks:

| File | Purpose |
|------|---------|
| `button.tsx` | Gradient and glass button variants with glow shadows |
| `card.tsx` | Card container, title with `text-gradient-accent` |
| `input.tsx` | Styled input with `focus-visible:shadow-glow-accent-sm` |
| `textarea.tsx` | Same treatment as input |
| `label.tsx` | Label with text-secondary |
| `toast.tsx` | Radix Toast with 4 variants (default, success, error, warning) |
| `error-page-shell.tsx` | Shared error page layout with role="alert" |

---

## Component Architecture

### Layout
```
Root (flex)
├── Sidebar (sticky, glass, collapsed by default)
└── Main Content (flex-1, overflow-x-hidden)
    ├── Container Page (max-w-1440px, responsive padding)
    └── Children
```

### Cards Grid
Uses CSS **Columns** (not CSS Grid) for masonry layout:
- `column-count: 4` (lg), `2` (md), `1` (sm)
- Each card wrapped in `break-inside: avoid`

Card structure:
```
[Card - gradient bg, rounded, border]
├── [Image - aspect-3/2, FittedImage component]
├── [Name - 1 line, font-display, gradient on hover]
└── [Tags - gradient bg separator, accent pill tags]
```

### Image Handling
`components/shared/FittedImage.tsx` wraps `next/image` with:
- Configurable `aspectRatio` (default "4/3")
- Fit modes: cover, contain, fill
- Gradient overlay via `showOverlay` prop
- Fixed-size container via CSS module

### Error & Notification System
```
exceptions/
├── errorPages/              — Importable error components
│   ├── not-found.tsx (404)
│   ├── server-error.tsx (500)
│   ├── forbidden.tsx (403)
│   ├── service-unavailable.tsx (503)
│   ├── bad-request.tsx (400)
│   └── general-error.tsx
└── notifications/
    └── success.tsx          — Toast + inline success modes
```

### Toast System
Built on `@radix-ui/react-toast`:
- `ui/primitives/toast.tsx` — Provider, Viewport, Toast (4 variants)
- `ui/notifications/use-toast.ts` — Hook + `toast()`, `successToast()`, `errorToast()`, `warningToast()` helpers
- `ui/notifications/toaster.tsx` — `<Toaster />` drop-in component

---

## Gradient Usage Patterns

### Card Background Gradients
```css
background:
  linear-gradient(160deg, var(--color-abyss-900), var(--color-abyss-850), var(--color-abyss-800));
```

### Tags Section Gradients
```css
background:
  linear-gradient(135deg,
    color-mix(in srgb, var(--color-accent) 8%, var(--color-abyss-800)),
    color-mix(in srgb, var(--color-accent) 3%, var(--color-abyss-900)));
```

### Auth Button Gradients
```css
/* Sign In */
background: linear-gradient(135deg, var(--color-ember-500), var(--color-accent));

/* Sign Up */
background: var(--glass-bg);
backdrop-filter: blur(12px);
```

### Text Gradients
```css
/* Hero / Logo */
background: linear-gradient(135deg, var(--color-ember-300), var(--color-accent), var(--color-ember-200));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;

/* Card name on hover */
background: linear-gradient(135deg, var(--color-ember-200), var(--color-accent), var(--color-ember-400));
```

### Body Background
```css
background-image:
  radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--color-abyss-600) 30%, transparent) 0%, transparent 100%),
  radial-gradient(ellipse 60% 40% at 80% 100%, color-mix(in srgb, var(--color-abyss-500) 15%, transparent) 0%, transparent 100%);
```

---

## File Locations

| Path | Description |
|------|-------------|
| `app/globals.css` | Design tokens, utilities, animations |
| `app/layout.tsx` | Font config, root layout |
| `styles/*.module.css` | CSS module files |
| `ui/primitives/` | Base UI components |
| `ui/notifications/` | Toast system |
| `exceptions/` | Error pages, notifications |
| `components/` | Feature components |
| `components/shared/FittedImage.tsx` | Image component |
| `lib/utils.ts` | `cn()` utility |
