/** Scheduling, tick execution, backoff, lifecycle and public API. */
import { WORKER_INTERVALS, WORKER_IDLE_CEIL, JITTER_RATIO, STAGGER_MS, type WorkerName } from "./config";
import { store, getState, logProcessed, logError, type WorkersStore, type WorkerState } from "./state";
import { TICKS } from "./ticks";

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
