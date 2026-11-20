/** One work-check per worker; returning 0 means idle. */
import { drainGames, drainLikes } from "@/utilities/pull";
import { processGamesQueue } from "@/lib/GamesInsert";
import { getQueueStats, processBatch } from "@/utilities/gameFetchPipeline";
import { warmUpCache } from "@/lib/cache-warmup";
import { keepMongoAlive } from "@/models/games/mongodb/client";
import { queueSize } from "@/utilities/queue";
import type { WorkerName } from "./config";

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

export const TICKS: Record<WorkerName, () => Promise<number>> = {
  mongoGames: tickMongoGames,
  neonGames: tickNeonGames,
  neonLikes: tickNeonLikes,
  fetchBatch: tickFetchBatch,
  cacheWarmup: tickCacheWarmup,
};
