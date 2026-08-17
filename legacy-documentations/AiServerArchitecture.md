# RPG AI Server — System Architecture & Plan

Two systems talk through **shared Redis** (Upstash). The AI server is a Python FastAPI server that does the actual AI agent processing. Next.js is the web server.

---

## Redis Data Layout (shared between both servers)

```
input:queue                List   { uuid: session_id, prompt: string }
trigger:last               Str    unix timestamp of last FastAPI trigger
trigger:busy               Str    "1" while FastAPI is processing (TTL 30s)

games:{sid}:state          Str    JSON blob — full RPG session state
games:{sid}:counter        Str    action count (INCR)
games:{sid}:event          Str    SSE event payload — written by /worker, read by SSE

output:{sid}               Str    AI output cache (GET/SET with EX)
rag:{sid}:{idx}            Str    RAG story chunks
```

All `games:{sid}:*` keys get TTL reset to 1h on each user action.

---

## Data Flow

```
Client (browser)            Next.js                          AI Server (FastAPI)
      │                        │                                    │
      │  Enter game            │                                    │
      │───────────────────────►│                                    │
      │                        │  generate session_uuid             │
      │                        │  write initial state               │
      │                        │  → SET games:{sid}:state (TTL 1h) │
      │                        │                                    │
      │  Send action           │                                    │
      │  POST /play {prompt}   │                                    │
      │───────────────────────►│                                    │
      │                        │  RPUSH input:queue {uuid:sid,prompt}
      │                        │  touch TTL on games:{sid}:*        │
      │                        │                                    │
      │                        │  trigger check:                    │
      │                        │  LLEN input:queue >= 5             │
      │                        │    OR 1s since last trigger        │
      │                        │    AND trigger:busy not set        │
      │                        │                                    │
      │                        │  ┌── NO → return 202               │
      │                        │  └── YES → POST /trigger ────────►│
      │                        │           (empty signal)           │
      │                        │           SET trigger:busy=1       │
      │                        │                                    │
      │                        │                    drain all input:queue
      │                        │                    for each item:
      │                        │                      RAG retrieval
      │                        │                      graph building
      │                        │                      agent workflow
      │                        │                      write state + output
      │                        │                                    │
      │                        │  POST /worker {uuid} ◄────────────│
      │                        │           DEL trigger:busy         │
      │                        │                                    │
      │                        │  SET games:{sid}:event = payload   │
      │                        │                                    │
      │  SSE ◄─────────────────│                                    │
      │  (polls every 200ms)   │                                    │
      │                        │                                    │
      │  merge state, render   │                                    │
      │  snapshot sessionStorage│                                   │
      │  every 10min           │                                    │
```

---

## Session Lifecycle

### New Session
1. User clicks play on a game → `GET /game/{game_uuid}`
2. Frontend checks `sessionStorage` for cached session
3. If miss → generate `session_uuid` (crypto.randomUUID())
4. Fetch game data from DB (chars, maps, items)
5. `SET games:{sid}:state` with initial JSON blob (TTL 1h)
6. Store `{ sid, game_uuid }` in sessionStorage

### Existing Session
1. `sessionStorage` has `{ sid, game_uuid }`
2. `GET games:{sid}:state` from Redis via Upstash
3. If exists → resume game
4. If expired/not found → treat as new game

### TTL Refresh
Every user action resets TTL to 1h on `games:{sid}:*` keys.
After 1h inactivity → session auto-cleans from Redis.

---

## Trigger System

```
onPlayerAction():
  1. RPUSH input:queue {uuid, prompt}
  2. touchTTL(sid)
  3. checkTrigger()

checkTrigger():
  1. len = LLEN input:queue
  2. if len == 0 → return
  3. busy = GET trigger:busy
  4. if busy == "1" → return (already processing)
  5. last = GET trigger:last (unix seconds)
  6. now = Date.now() / 1000
  7. shouldFire = (len >= 5) OR (now - last >= 1)
  8. if shouldFire → fireTrigger()

fireTrigger():
  1. SET trigger:busy = "1" (EX 30) — prevent double-trigger
  2. POST http://ai-server:8000/trigger
  3. SET trigger:last = now
```

---

## Next.js API Routes

### POST /api/games/[uuid]/play
- Accepts: `{ prompt: string }`
- Pushes to `input:queue`
- Calls `checkTrigger()`
- Returns 202

### GET /api/games/[uuid]/stream
- SSE endpoint
- Polls `games:{sid}:event` every 200ms
- Pushes events to client
- Closes on error/disconnect

### POST /api/games/worker
- FastAPI callback
- Accepts: `{ uuid: session_id }`
- Writes to `games:{sid}:event`
- SSE picks it up

---

## Next.js Client Library

### hooks/useGamePlay.ts
```
useGamePlay(uuid):
  sendAction(prompt) → POST /api/games/{uuid}/play
  state ← SSE /api/games/{uuid}/stream
  snapshot to sessionStorage every 10min
```

### lib/ai-redis.ts
```
pushPlayerAction(sid, prompt)
readGameState(sid)
touchSessionTTL(sid)
readOutput(sid)
incrActionCounter(sid)
```

### lib/game-trigger.ts
```
checkTrigger()   → queue >=5? 1s passed?
fireTrigger()    → POST /trigger to FastAPI
```

---

## Implementation Order

1. `lib/ai-redis.ts` — Redis operations (uses existing Upstash client)
2. `lib/game-trigger.ts` — Trigger logic
3. `app/api/games/[uuid]/play/route.ts` — Player action endpoint
4. `app/api/games/[uuid]/stream/route.ts` — SSE endpoint
5. `app/api/games/worker/route.ts` — FastAPI callback
6. `hooks/useGamePlay.ts` — Client hook
7. `types/play.ts` — Types

---

## AI Server FastAPI Endpoints (reference)

```
GET  /health               → {"status":"ok"}
POST /trigger              → trigger processing (empty signal, reads queue from Redis)

Queue (input:):
  POST /queue/push         → RPUSH (not used by Next.js — we write directly to Redis)
  GET  /queue/pop          → LPOP (AI server uses this)
  GET  /queue/length       → LLEN

Game State (games:{sid}:):
  GET  /{sid}/state        → HGETALL (admin/monitoring)
  PUT  /{sid}/state/{f}    → HSET
  POST /{sid}/counter/incr → INCR
  POST /{sid}/expire       → EXPIRE

Output (output:{sid}):
  GET  /{sid}              → GET
  PUT  /{sid}              → SET with EX

RAG:
  GET  /rag/chunk/{sid}/{i}  → GET rag:{sid}:{i}
```

---

## Error Handling

```
- Queue push fails       → return 500, prompt lost (retry on client)
- Trigger POST fails     → trigger:busy auto-expires in 30s, retries on next action
- Worker POST fails      → FastAPI retries (3 attempts, backoff)
- SSE connection drops   → client reconnects, polls last known event
- Session expired        → fresh start, generate new sid
```

---

## Game Architecture (from graphify-out)

Graph analysis of the existing game backend (320 files indexed).

### Game Pipeline Abstraction

```
Game Creation Pipeline:
  create_form → api_convertUrl → api_push → ConvertGameImages → pushGames

Backend Game Processing (cohesion 0.09, 36 nodes):
  processGamesQueue → warmUpCache → getGamesPaginated → insertGame
  validateJWTMiddleware → classifyError → GamesInsert

Games API Cache & Drain (cohesion 0.17, 20 nodes):
  GET/POST cache routes → CACHE_KEYS → ensureCachePrimed
  getCachedGameIds → getGameFromCache → mergePendingLikes

Game Fetch Pipeline (Client) (cohesion 0.13, 30 nodes):
  getGameWithBatchQueue → pollGameResult → requestGameFetch
  useErrorHandler → errorToast → warningToast → ClassifiedError

MongoDB Operations:
  GamesInsert (processGamesQueue) → patch-applier (applyGamePatches)
  Mongoose schema → batch inserts → atomic updates

Redis Cache Layer:
  queue.ts (Upstash client) → cache-warmup (warmUpCache)
  setGameInCache → getGameFromCache → mergePendingLikes/mergePendingLikesBatch

Error Handling Spine:
  classifyError → used by GamesInsert, cache-warmup, db,
  jwt-validate, patch-applier, useAuth, useIdempotentRequest

Drain Pattern:
  queue.drain() → atomic RENAME → LRANGE → DEL → batch insert
  Triggered by: GET /api/drain, auto-trigger from /api/games
```

### Key Files (game backend)

| File | Lines | Role |
|------|-------|------|
| `lib/queue.ts` | 19 | Upstash Redis client singleton |
| `lib/cache-warmup.ts` | 155 | Cache priming + game CRUD in Redis |
| `lib/GamesInsert.ts` | 23 | Queue drain → MongoDB insert |
| `lib/db.ts` | ~80 | PostgreSQL queries (getGames, insertGame) |
| `lib/patch-applier.ts` | 115 | JSON Patch on MongoDB |
| `utilities/queue.ts` | 46 | Generic drain (atomic rename) |
| `utilities/pull.ts` | 42 | drainLikes + drainGames |
| `utilities/gameFetchPipeline.ts` | 212 | Batch fetch queue for game detail |
| `utilities/hotnessCache.ts` | 384 | Binary-sorted hotness cache (top 1000) |
| `app/api/games/route.ts` | 104 | Paginated games list + drain trigger |
| `app/api/games/[id]/route.ts` | 47 | Game detail (standard cache) |
| `app/api/games/[id]/route-gamepage.ts` | 59 | Game detail (hotness cache) |
| `app/api/games/[id]/patches/route.ts` | 32 | POST JSON patches to MongoDB |
| `app/api/drain/route.ts` | 45 | Drain endpoint (games + likes) |
| `app/api/push/route.ts` | ~50 | Push game to Redis queue |
| `app/api/push/pushGames/route.ts` | ~50 | Push extended data to MongoDB queue |
| `models/games/mongodb/schema.ts` | ~30 | Mongoose schema |
| `models/games/mongodb/client.ts` | ~20 | MongoDB connection |

---

## Open Questions

### State & Data

1. **Initial state format** — When Next.js starts a new session, what JSON shape does it write to `games:{sid}:state`? Raw DB dump (chars[], maps[], items[]) wrapped in `{ assets: {...} }`, or a specific structure the AI server expects?

2. **AI server output format** — After FastAPI processes, it writes to both `games:{sid}:state` and `output:{sid}`. What's in each? Is `output:{sid}` a diff/subset, or the same full state? Does the SSE push `output:{sid}` or the full state?

3. **Chunks/RAG on init** — When Next.js initializes a session, does it write initial RAG chunks to `rag:{sid}:{idx}`, or does the AI server handle the entire RAG pipeline internally?

### Session & Identity

4. **Route ambiguity** — `/api/games/[uuid]/play` — is `[uuid]` the **game UUID** (from DB) or the **session UUID** (client-generated)? If game UUID, how does the server know the session ID? Does the client send `sid` in the POST body?

5. **Auth** — Does `/play` require JWT auth like all other API routes? Are sessions tied to a user, or fully anonymous? Can a user have multiple sessions across different games?

6. **Two tabs, same game** — If a user opens the same game in two browser tabs, do they get two independent sessions (two sids) or share one? If independent, each has its own state in Redis?

### Queue & Trigger

7. **Queue item depth** — `{ uuid: sid, prompt: string }` — is there more? Timestamp? `action_type: "move"|"attack"|"talk"|"use"`? User ID?

8. **Race condition on trigger** — Two actions arrive at the same time, both see `trigger:busy` not set, both fire `SET trigger:busy` — the second overwrites the first. FastAPI gets two `/trigger` calls. Is that handled (second call finds empty queue and returns)? Or use `SET NX` on `trigger:busy`?

9. **Processing timeout** — FastAPI processes the full queue in one batch. If processing takes >30s, `trigger:busy` expires and a new trigger fires while the first is still running. How to handle? Longer TTL? Or FastAPI refreshes `trigger:busy` periodically?

### Error Recovery

10. **Crash mid-processing** — FastAPI drains `input:queue` (LPOP all items), then crashes. Those items are gone from the queue but never processed. Should we use an atomic rename pattern (like the existing `drain()` in `utilities/queue.ts`) to move items to `input:queue:processing` first?

11. **Worker callback failure** — FastAPI finishes but `POST /worker` to Next.js fails. State is updated in Redis but the client never gets notified via SSE. Does the client just time out and poll again? Or does FastAPI retry the callback?

### SSE & Client

12. **SSE serverless limits** — Vercel serverless has timeout limits (Hobby 10s, Pro 30s). SSE needs a long-lived connection. How to handle? Use Edge Runtime (longer timeouts)? Or fall back to polling if SSE fails?

13. **SSE reconnect** — SSE drops. `useGamePlay` reconnects — does it need to know the last event ID to avoid replaying stale events? Or does it just re-read the full state from `games:{sid}:state` on reconnect?

14. **sessionStorage snapshot** — "Snapshot every 10min" — what exactly is saved? Full `games:{sid}:state`? On reload, is the snapshot used as a loading placeholder while Redis state is fetched?

### Lifecycle

15. **Game end** — How does a game end? Player dies, wins, or just leaves. Does the session get explicitly cleaned up (DEL keys), or just wait for TTL expiry? Is there a "game over" event pushed to SSE?

### Batch & Callback

16. **Multi-session batch callback** — FastAPI processes ~5 items from the queue. If those items belong to 5 different sessions, does it send 5 separate POSTs to `/worker` (one per `uuid`), or one POST with `{ uuids: [sid1, sid2, ...] }`?

17. **State vs event payload** — SSE polls `games:{sid}:event`. When worker writes to it, does SSE then read `games:{sid}:state` and send the full state to the client? Or does the event itself contain the delta?

18. **Client-side merge strategy** — SSE pushes new state. Does `useGamePlay` replace the entire local state or merge? If merge, conflict resolution strategy?

19. **Event overwrite race** — Two worker callbacks arrive for the same session before SSE polls. Second overwrites first in Redis. Client misses the first event. Acceptable since state is always latest? Or need event IDs?

### UI & Rendering

20. **State transition animation** — When SSE pushes new state (health drops, story updates, inventory changes), does the UI animate/fade the changes, highlight diffs, or just re-render?

21. **sessionStorage snapshot usage** — On page load, if sessionStorage has a cached snapshot, does the UI render it immediately (optimistic) while fetching fresh state from Redis? Or wait for Redis?

### Testing

22. **Test strategy** — How to test the gameplay loop? Integration test with local Redis? Mock the FastAPI `/trigger`? E2E with Playwright connecting to a test AI server?
