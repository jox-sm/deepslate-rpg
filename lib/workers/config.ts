/** Worker cadence configuration and shared worker types. */
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

export type WorkerName = keyof typeof WORKER_INTERVALS;

// Idle ceiling: when a worker finds no work, its delay backs off
// exponentially from the active cadence up to this cap. Next piece
// of work resets it to the fast cadence immediately.
export const WORKER_IDLE_CEIL: Record<WorkerName, number> = {
  mongoGames: envMs("WORKER_MONGO_GAMES_IDLE_MS", 5_000, WORKER_INTERVALS.mongoGames),
  neonGames: envMs("WORKER_NEON_GAMES_IDLE_MS", 5_000, WORKER_INTERVALS.neonGames),
  neonLikes: envMs("WORKER_NEON_LIKES_IDLE_MS", 10_000, WORKER_INTERVALS.neonLikes),
  fetchBatch: envMs("WORKER_FETCH_BATCH_MS_IDLE", 2_000, WORKER_INTERVALS.fetchBatch),
  cacheWarmup: envMs("WORKER_CACHE_WARMUP_IDLE_MS", 60_000, WORKER_INTERVALS.cacheWarmup),
};

export const JITTER_RATIO = 0.15;
export const STAGGER_MS = 25;
