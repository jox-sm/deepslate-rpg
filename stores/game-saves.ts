// stores/game-saves.ts — in-memory save vault for the play flow.
//
// Saves (scenario slots, AI memory blobs, turn counters) live in a zustand
// store for the lifetime of the tab — deliberately NOT persisted to
// localStorage. Durability is user-driven: the PlayScreen "Save" button pulls
// the session's memory from the AI server (Redis/Upstash Search) into this
// store and downloads a versioned JSON snapshot of everything
// (lib/saveFile.ts). Import the file back from the scenario list to regain a
// run. Contract: REDIS_API.md → "Scenario Lifecycle — Named Save Slots".

import { create } from "zustand";
import type { AiMemoryChunk } from "@/types/ai-server";

export interface ScenarioMeta {
  id: string;
  name: string;
  created_at: number;
  last_played_at: number;
}

export interface ScenarioMemoryBlob {
  sid: string;
  saved_at: number;
  last_turn: number;
  chunks: AiMemoryChunk[];
}

/** File-schema shape: memories as an array (ordered, human-readable). */
export interface GameSavesFileMerge {
  scenarios: ScenarioMeta[];
  memories: ScenarioMemoryBlob[];
  turns: Record<string, number>;
}

/** In-vault shape: keyed by scenario id for O(1) lookups. */
interface GameSavesState {
  scenarios: ScenarioMeta[];
  memories: Record<string, ScenarioMemoryBlob>;
  turns: Record<string, number>;
  upsertScenario: (scenario: ScenarioMeta) => void;
  removeScenario: (id: string) => void;
  setMemory: (blob: ScenarioMemoryBlob) => void;
  removeMemory: (id: string) => void;
  setTurn: (id: string, turn: number) => void;
  /** Merges a save file into the vault: known scenario ids get their blob/turn
   * overwritten, unknown ones are added. Result is capped to `maxScenarios`. */
  importSnapshot: (snapshot: GameSavesFileMerge, maxScenarios: number) => void;
  /** Test seam: the store is module-scoped; tests reset it per case. */
  resetForTests: () => void;
}

function isBlobShape(value: unknown): value is ScenarioMemoryBlob {
  if (!value || typeof value !== "object") return false;
  const b = value as ScenarioMemoryBlob;
  return typeof b.sid === "string" && Array.isArray(b.chunks);
}

export const useGameSavesStore = create<GameSavesState>()((set) => ({
  scenarios: [],
  memories: {},
  turns: {},

  upsertScenario: (scenario) =>
    set((state) => {
      const idx = state.scenarios.findIndex((s) => s.id === scenario.id);
      const scenarios = [...state.scenarios];
      if (idx === -1) scenarios.push(scenario);
      else scenarios[idx] = scenario;
      return { scenarios };
    }),

  removeScenario: (id) =>
    set((state) => {
      const cleanRecord = <T extends Record<string, unknown>>(rec: T): T => {
        if (!(id in rec)) return rec;
        const next = { ...rec } as Record<string, unknown>;
        delete next[id];
        return next as T;
      };
      return {
        scenarios: state.scenarios.filter((s) => s.id !== id),
        memories: cleanRecord(state.memories),
        turns: cleanRecord(state.turns),
      };
    }),

  setMemory: (blob) =>
    set((state) => {
      if (!isBlobShape(blob) || !state.scenarios.some((s) => s.id === blob.sid)) {
        // Blobs must belong to a registered scenario — orphans are dropped so
        // the vault never grows slots that nothing entered from.
        return {};
      }
      return { memories: { ...state.memories, [blob.sid]: blob } };
    }),

  removeMemory: (id) =>
    set((state) => {
      if (!(id in state.memories)) return {};
      const next = { ...state.memories };
      delete next[id];
      return { memories: next };
    }),

  setTurn: (id, turn) =>
    set((state) =>
      state.turns[id] === turn ? {} : { turns: { ...state.turns, [id]: turn } },
    ),

  importSnapshot: (snapshot, maxScenarios) =>
    set((state) => {
      const mergedScenarios = new Map(state.scenarios.map((s) => [s.id, s]));
      for (const s of snapshot.scenarios ?? []) {
        if (s && typeof s.id === "string") mergedScenarios.set(s.id, s);
      }
      let scenarios = [...mergedScenarios.values()].sort(
        (x, y) => y.last_played_at - x.last_played_at,
      );
      // Respect the slot budget: newest wins.
      if (scenarios.length > maxScenarios) scenarios = scenarios.slice(0, maxScenarios);

      const memories = { ...state.memories };
      for (const blob of snapshot.memories ?? []) {
        if (isBlobShape(blob)) memories[blob.sid] = blob;
      }
      // Keep the vault consistent: blobs for unregistered slots are dropped.
      for (const sid of Object.keys(memories)) {
        if (!scenarios.some((s) => s.id === sid)) delete memories[sid];
      }

      const turns: Record<string, number> = { ...state.turns };
      for (const [sid, turn] of Object.entries(snapshot.turns ?? {})) {
        if (scenarios.some((s) => s.id === sid) && typeof turn === "number"
            && Number.isFinite(turn) && turn >= 0) {
          turns[sid] = turn;
        }
      }
      // Turn entries for dead slots go too.
      for (const sid of Object.keys(turns)) {
        if (!scenarios.some((s) => s.id === sid)) delete turns[sid];
      }

      return { scenarios, memories, turns };
    }),

  resetForTests: () => set({ scenarios: [], memories: {}, turns: {} }),
}));
