@AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

All project agent skills are centralized in `.agents/skills/`.

<!-- convex-ai-end -->

<!-- anchored-summary-start -->

## Project State: Deepslate Dungeons

Dark fantasy RPG game creation platform. Next.js 16 App Router, React 19, Tailwind v4, Convex (realtime), Clerk (auth), Neon (PostgreSQL), MongoDB, Redis, Supabase Storage.

### UI Architecture
- **Styling:** CSS Modules at `styles/*.module.css` for structural/layout styles + Tailwind v4 utilities via `cn()` from `lib/utils.ts`. No pure CSS modules alone, no pure Tailwind alone — always the hybrid `cn(styles.xxx, "tailwind")` pattern.
- **Design System:** `app/globals.css` @theme block — abyss purple palette (`--color-abyss-950` to `--color-abyss-100`), ember glow accent (`--color-ember-600` to `--color-ember-100`), semantic tokens (`--color-bg-surface`, `--color-text-primary`, `--color-accent`), glass utilities, glow shadows, gradient text utilities.
- **Fonts:** Cormorant Garamond (`--font-display`, headings) + DM Sans (`--font-sans`, body).
- **Primitives:** `ui/primitives/` — button (gradient/glass variants), card, input, textarea, label, toast (Radix), error-page-shell.
- **Toast System:** `ui/notifications/` — Radix-based `toast()`, `successToast()`, `errorToast()`, `warningToast()` helpers, auto-dismiss 5s, max 5.
- **Error Pages:** `exceptions/errorPages/` — importable 404/500/403/503/400/general components.
- **Cards Grid:** CSS Columns layout (`column-count: 4/2/1`), gradient card backgrounds, compact design (image 3:2 → name → tags with gradient bg).
- **FittedImage:** `components/shared/FittedImage.tsx` — next/image wrapper with configurable aspectRatio, fit modes, gradient overlay.
- **Sidebar:** `components/background/slidebar.tsx` — sticky, glass effect, collapse animation, uses `styles/sidebar/sidebar.module.css`.
- **CSS Module Index:** `styles/pages/`, `styles/layout/`, `styles/cards/`, `styles/forms/`, `styles/sidebar/`, `styles/authentication/`, `styles/auth/`, `styles/shared/`.

### Backend
- Convex real-time tables (games, characters, maps, items).
- Clerk auth with JWT templates for Supabase/Neon/MongoDB.
- API routes with idempotency (UUID v7 + Redis dedup).
- Cache layer: Redis (games list, individual game, metadata).
- DB: Neon PostgreSQL (primary game data) + MongoDB (extended data: characters, maps, items).
- Image uploads: Supabase Storage with retry, progress tracking, binary conversion.
- Background worker for game creation pipeline (Redis queue → DB insert → cache warm).

### Key Conventions
- DB retries: `async () => { await sql... }` wrapper (not direct `sql` call).
- `cacheInitialized` flag sets only after successful warm-up attempt.
- Supabase storage hostname + quality 85 configured in `next.config.ts`.
- Error notifications use `toast.errorToast()` pattern.

<!-- anchored-summary-end -->
