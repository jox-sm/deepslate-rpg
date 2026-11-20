/** Global worker state (single shared instance across HMR reloads) + logging. */
import { classifyError } from "@/utilities/errorHandler";
import { WORKER_INTERVALS, type WorkerName } from "./config";

export interface WorkerState {
  nextDelayMs: number;
  idleStreak: number;
  consecutiveErrors: number;
  lastRun: number | null;
  lastProcessed: number;
}

export interface WorkersStore {
  timers: Map<WorkerName, NodeJS.Timeout>;
  state: Map<WorkerName, WorkerState>;
  inflight: Set<WorkerName>;
  started: boolean;
  stopping: boolean;
  hooked: boolean;
}

// Kept on globalThis so dev HMR reloads don't orphan timers or
// double-start workers.
export function store(): WorkersStore {
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

export function getState(s: WorkersStore, name: WorkerName): WorkerState {
  let st = s.state.get(name);
  if (!st) {
    st = { nextDelayMs: WORKER_INTERVALS[name], idleStreak: 0, consecutiveErrors: 0, lastRun: null, lastProcessed: 0 };
    s.state.set(name, st);
  }
  return st;
}

export function logProcessed(name: string, processed: number): void {
  if (processed > 0) {
    console.log(`[Workers:${name}] processed ${processed}`);
  }
}

export function logError(name: string, error: unknown): void {
  const classified = classifyError(error, `Workers.${name}`);
  // Log the raw error too: classified.message is a user-facing string
  // ("realm severed", "weave of reality") that hides the real cause.
  console.error(`[Workers:${name}] tick failed:`, classified.message,
    '| raw:', String(classified.originalError ?? error));
}
