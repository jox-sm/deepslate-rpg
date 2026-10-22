import { drainGames, drainLikes } from "@/utilities/pull";
import { processGamesQueue } from "@/lib/GamesInsert";
import { getQueueStats, processBatch } from "@/utilities/gameFetchPipeline";
import { warmUpCache } from "@/lib/cache-warmup";
import { keepMongoAlive } from "@/models/games/mongodb/client";
import { queueSize } from "@/utilities/queue";
import { classifyError } from "@/utilities/errorHandler";

function envMs(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(Math.floor(n), min);
}

// Active (busy) cadence: how fast a worker re-fires while it keeps
// finding work. Override with env vars. Floors keep Redis/DB safe.
export const WORKER_INTERVALS = {
  // MongoDB games queue -> Game.insertMany
  mongoGames: envMs("WORKER_MONGO_GAMES_MS", 500, 50),
  // Neon games queue -> insertGamesBatch
  neonGames: envMs("WORKER_NEON_GAMES_MS", 500, 50),
  // Neon likes queue -> updateGamesLikesBatch (likes also merge on read)
  neonLikes: envMs("WORKER_NEON_LIKES_MS", 1_000, 100),
  // GamePage batch fetch pipeline (processBatch itself waits ~200ms
  // per batch, so values below that have no extra effect)
  fetchBatch: envMs("WORKER_FETCH_BATCH_MS", 200, 50),
  // Cache priming: warmUpCache self-skips when already primed,
  // so this is just a slow safety re-check, not a poll loop.
  cacheWarmup: envMs("WORKER_CACHE_WARMUP_MS", 60_000, 5_000),
};

type WorkerName = keyof typeof WORKER_INTERVALS;

// Idle ceiling: when a worker finds no work, its delay backs off
// exponentially from the active cadence up to this cap. Next piece
// of work resets it to the fast cadence immediately.
const WORKER_IDLE_CEIL: Record<WorkerName, number> = {
  mongoGames: envMs("WORKER_MONGO_GAMES_IDLE_MS", 5_000, WORKER_INTERVALS.mongoGames),
  neonGames: envMs("WORKER_NEON_GAMES_IDLE_MS", 5_000, WORKER_INTERVALS.neonGames),
  neonLikes: envMs("WORKER_NEON_LIKES_IDLE_MS", 10_000, WORKER_INTERVALS.neonLikes),
  fetchBatch: envMs("WORKER_FETCH_BATCH_MS_IDLE", 2_000, WORKER_INTERVALS.fetchBatch),
  cacheWarmup: envMs("WORKER_CACHE_WARMUP_IDLE_MS", 60_000, WORKER_INTERVALS.cacheWarmup),
};

const JITTER_RATIO = 0.15;
const STAGGER_MS = 25;

interface WorkerState {
  nextDelayMs: number;
  idleStreak: number;
  consecutiveErrors: number;
  lastRun: number | null;
  lastProcessed: number;
}

interface WorkersStore {
  timers: Map<WorkerName, NodeJS.Timeout>;
  state: Map<WorkerName, WorkerState>;
  inflight: Set<WorkerName>;
  started: boolean;
  stopping: boolean;
  hooked: boolean;
}

// Kept on globalThis so dev HMR reloads don't orphan timers or
// double-start workers.
function store(): WorkersStore {
  const g = globalThis as unknown as { __deepslate_workers__?: WorkersStore };
  if (!g.__deepslate_workers__) {
    g.__deepslate_workers__ = {
      timers: new Map(),
      state: new Map(),
      inflight: new Set(),
      started: false,
      stopping: false,
      hooked: false,
    };
  }
  return g.__deepslate_workers__;
}

function getState(s: WorkersStore, name: WorkerName): WorkerState {
  let st = s.state.get(name);
  if (!st) {
    st = { nextDelayMs: WORKER_INTERVALS[name], idleStreak: 0, consecutiveErrors: 0, lastRun: null, lastProcessed: 0 };
    s.state.set(name, st);
  }
  return st;
}

function logProcessed(name: string, processed: number): void {
  if (processed > 0) {
    console.log(`[Workers:${name}] processed ${processed}`);
  }
}

function logError(name: string, error: unknown): void {
  const classified = classifyError(error, `Workers.${name}`);
  // Log the raw error too: classified.message is a user-facing string
  // ("realm severed", "weave of reality") that hides the real cause.
  console.error(`[Workers:${name}] tick failed:`, classified.message,
    '| raw:', String(classified.originalError ?? error));
}

// Each tick checks for work first. No work => returns 0, the tick
// terminates there and the worker backs off until the next fire.
async function tickMongoGames(): Promise<number> {
  const size = await queueSize("mongodb", "games").catch(() => -1);
  if (size === 0) return 0;
  const { processed } = await processGamesQueue();
  return processed;
}

async function tickNeonGames(): Promise<number> {
  const size = await queueSize("neon", "games").catch(() => -1);
  if (size === 0) return 0;
  const { processed } = await drainGames();
  return processed;
}

async function tickNeonLikes(): Promise<number> {
  const size = await queueSize("neon", "likes").catch(() => -1);
  if (size === 0) return 0;
  const { processed } = await drainLikes();
  return processed;
}

async function tickFetchBatch(): Promise<number> {
  const stats = await getQueueStats().catch(() => ({ queueLength: -1 }));
  if (stats.queueLength === 0) return 0;
  await processBatch();
  return stats.queueLength > 0 ? 1 : 0;
}

async function tickCacheWarmup(): Promise<number> {
  // Atlas terminates idle clusters, and the nested game data (characters /
  // maps / items) only exists in MongoDB. A heartbeat on the slow worker
  // keeps the cluster from being reclaimed.
  void keepMongoAlive();

  // Returns false when already primed => idle, terminates the tick.
  const warmed = await warmUpCache();
  return warmed ? 1 : 0;
}

const TICKS: Record<WorkerName, () => Promise<number>> = {
  mongoGames: tickMongoGames,
  neonGames: tickNeonGames,
  neonLikes: tickNeonLikes,
  fetchBatch: tickFetchBatch,
  cacheWarmup: tickCacheWarmup,
};

function withJitter(ms: number): number {
  const delta = ms * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(25, Math.round(ms + delta));
}

function schedule(s: WorkersStore, name: WorkerName, delayMs: number): void {
  if (s.stopping) return;
  const timer = setTimeout(() => {
    void runTick(name);
  }, withJitter(delayMs));
  // Never keep the Node process alive just for workers.
  if (typeof timer.unref === "function") timer.unref();
  const prev = s.timers.get(name);
  if (prev) clearTimeout(prev);
  s.timers.set(name, timer);
}

async function runTick(name: WorkerName): Promise<void> {
  const s = store();
  if (s.stopping || s.inflight.has(name)) return;
  s.inflight.add(name);
  const st = getState(s, name);
  st.lastRun = Date.now();
  try {
    const processed = await TICKS[name]();
    st.lastProcessed = processed;
    st.consecutiveErrors = 0;
    if (processed > 0) {
      // Work found => back to the fast cadence immediately.
      st.idleStreak = 0;
      st.nextDelayMs = WORKER_INTERVALS[name];
      logProcessed(name, processed);
    } else {
      // Idle => exponential backoff up to the ceiling.
      st.idleStreak += 1;
      st.nextDelayMs = Math.min(
        WORKER_INTERVALS[name] * 2 ** Math.min(st.idleStreak, 8),
        WORKER_IDLE_CEIL[name]
      );
    }
  } catch (error) {
    // Errors never kill the loop; they back off like idleness so a
    // down dependency isn't hammered at the fast cadence.
    st.idleStreak = 0;
    st.consecutiveErrors += 1;
    st.nextDelayMs = Math.min(
      WORKER_INTERVALS[name] * 2 ** Math.min(st.consecutiveErrors, 6),
      WORKER_IDLE_CEIL[name]
    );
    logError(name, error);
  }
  s.inflight.delete(name);
  schedule(s, name, st.nextDelayMs);
}

function hookGracefulShutdown(s: WorkersStore): void {
  if (s.hooked || typeof process === "undefined" || typeof process.once !== "function") return;
  s.hooked = true;
  process.once("SIGTERM", stopWorkers);
  process.once("SIGINT", stopWorkers);
}

export function startWorkers(): Map<WorkerName, NodeJS.Timeout> {
  const s = store();
  if (s.started && s.timers.size > 0) return s.timers;
  s.started = true;
  s.stopping = false;
  hookGracefulShutdown(s);

  const names = Object.keys(TICKS) as WorkerName[];
  names.forEach((name, idx) => {
    const st = getState(s, name);
    st.nextDelayMs = WORKER_INTERVALS[name];
    // Stagger first fires so workers don't hit Redis simultaneously.
    // Capped at 200ms so the cache primes promptly at boot.
    schedule(s, name, Math.min(WORKER_INTERVALS[name], 200) + idx * STAGGER_MS);
  });

  console.log("[Workers] started", {
    intervals: { ...WORKER_INTERVALS },
    idleCeilings: { ...WORKER_IDLE_CEIL },
  });
  return s.timers;
}

export function stopWorkers(): void {
  const s = store();
  s.stopping = true;
  for (const timer of s.timers.values()) clearTimeout(timer);
  s.timers.clear();
  s.inflight.clear();
  s.started = false;
  s.stopping = false;
  console.log("[Workers] stopped");
}

export function getWorkersStatus(): {
  running: boolean;
  intervals: typeof WORKER_INTERVALS;
  idleCeilings: Record<WorkerName, number>;
  activeTicks: WorkerName[];
  workers: Record<WorkerName, WorkerState>;
} {
  const s = store();
  return {
    running: s.started && s.timers.size > 0,
    intervals: { ...WORKER_INTERVALS },
    idleCeilings: { ...WORKER_IDLE_CEIL },
    activeTicks: [...s.inflight],
    workers: (Object.keys(TICKS) as WorkerName[]).reduce(
      (acc, name) => {
        acc[name] = { ...getState(s, name) };
        return acc;
      },
      {} as Record<WorkerName, WorkerState>
    ),
  };
}
