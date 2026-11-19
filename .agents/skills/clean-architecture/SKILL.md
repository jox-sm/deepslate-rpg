---
name: clean-architecture
description: Project architecture + compaction rules for the Deepslate Dungeons web app (Next.js 16/React 19/TS). Apply when refactoring, adding features, or "compacting" this codebase. Enforces server/client boundaries, thin routes, DRY, small files with behavior-preserving moves.
---

# Clean Architecture — Deepslate Dungeons Web

Use this skill for **every** code change in `app/`, `components/`, `lib/`, `stores/`, and `tests/`. Goal: small files, one reason to change per file, strict server/client boundaries, no duplicated logic.

## 1. The dependency rule (non-negotiable)

```
app/api/**/route.ts   controllers: auth (Clerk) → validate → delegate to lib. Thin.
   ↓
lib/                 server-only utilities: db, queue, retry, jwt, storage, AI client, gameSeed, saveFile
   ↓
stores/              zustand client state (likes persisted; saves in-memory vault)
   ↓
components/          React UI. Calls lib/playClient.ts via relays — NEVER cloud services directly.
```

- **Browser never calls FastAPI or cloud DBs directly.** All AI traffic goes through `app/api/ai-server/[...path]/route.ts` (Clerk-gated allowlist). Components use `lib/playClient.ts` / `lib/ai-server-client.ts`.
- Routes contain **no business logic**: auth check + input validation + one `lib/` call + typed error response. Reusable error mapping lives in `lib/errorHandler.ts`.
- Server-only modules (`db`, `queue`, `storage`) are never imported from client components. `process.env` secrets never reach the client bundle; only `NEXT_PUBLIC_*` may.
- Import direction: components → stores/lib client helpers; lib → lib; never lib → components, never route → component.

## 2. DRY — the single-source list

| Need | Use (only) |
|---|---|
| FastAPI calls | `lib/ai-server-client.ts` + `lib/playClient.ts` |
| Redis client / DB access | `lib/queue.ts` / `lib/db.ts` (single export each) |
| Retry / error classification | `lib/retry.ts` / `utilities/errorHandler.ts` |
| Game read pipeline | `utilities/gameFetchPipeline.ts` — no parallel fetch implementations in routes |
| JWT validation | `lib/jwt-validate.ts` (`validateJWTMiddleware`) |
| Save snapshot build/import | `lib/saveFile.ts` + `stores/game-saves.ts` (never `localStorage` for saves) |
| Session seeding | `lib/gameSeed.ts` (single-use `sessionStorage rpg:seed:{sid}`) |
| Auth UX | `components/auth-gate.tsx`; never duplicate sign-in redirects |
| Validation | `lib/validation.ts`; schemas shared between client and route |

**Red flags:** `fetch("http://...")` in a component, `new Redis`/`Mongoose` outside `lib/`, a second save serializer, copied Clerk auth checks, duplicated polling loops, hardcoded retry counts, `any` crossing module boundaries.

## 3. Component / function design

- Components are thin: props in, UI out. Data fetching in `lib/` or server routes. State in zustand stores or local hooks — never global mutable objects.
- One component = one reason to change; extract subcomponents when a JSX tree needs section headers to navigate.
- Pure helpers for transformations; no side effects during render. `useEffect` for subscriptions only, with cleanup.
- Types shared in `types/`/`lib/`; no duplicated interfaces. Strict TS: no implicit `any`, no `@ts-ignore` without an explanatory comment.
- Accessibility isn't optional: semantic elements, labels, keyboard handlers, focus states.

## 4. Compaction budgets

| Unit | Soft limit | Hard limit |
|---|---|---|
| File | 200 lines | 300 (split it) |
| Component | 150 lines | 200 |
| Function | 30 lines | 40 |
| Exports per module | 5 | — |

When splitting:
1. Move code **unchanged** into focused modules (`useX.ts`, `x-utils.ts`, subcomponents).
2. Leave a compatibility barrel: original module re-exports the moved names so imports/tests stay valid.
3. Run `npx tsc --noEmit` + `npm test` (baseline **113/113 tests**; 6 pre-existing tsc errors in `hooks/useIdempotentRequest.test.ts` and `lib/playClient.test.ts` — do NOT "fix" those in a move commit).
4. One move per step; no style/behavior changes mixed in. Review `git diff --stat`.

Known hotspots (split targets): `utilities/errorHandler.ts` (494), `components/game/PlayScreen.tsx` (360), `utilities/hotnessCache.ts` (383), `utilities/gameFetchPipeline.ts` (306), `lib/workers.ts` (246).

## 5. Contract invariants (must not change silently)

- Relay path `/api/ai-server/[...path]` with Clerk gate + gameplay allowlist.
- `GameRequest` = `{uuid, prompt, data, images, timestamp}`; `AI_SERVER_URL` default `http://127.0.0.1:8000`.
- PlayScreen polls `GET /output/{sid}` every 2s (~120s budget) with timestamp-based turn detection.
- Saves: in-memory zustand vault (`stores/game-saves.ts`); whole-vault JSON download/import (`lib/saveFile.ts`); NO localStorage persistence for saves.
- Keep folders `D:\AI agent` + `D:\deepslate dungeons` side-by-side (`docker-compose.yml` references `../deepslate dungeons`).

## 6. Definition of done

- [ ] Routes thin; no cloud calls from components; env boundaries respected
- [ ] Every helper has one owner; no duplicated logic
- [ ] Files/functions within budgets (or documented exception)
- [ ] Public exports preserved via barrels; imports/tests unchanged
- [ ] `tsc` matches baseline; 113/113 tests pass
- [ ] Accessibility and error states covered
