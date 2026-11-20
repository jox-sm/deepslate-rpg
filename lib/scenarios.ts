// lib/scenarios.ts — Named save slots (scenario lifecycle).
//
// The registry, AI memory blobs and turn counters live in the in-memory
// zustand vault `stores/game-saves.ts` (NOT localStorage). Durability is
// explicit and user-driven: the PlayScreen "Save" button snapshots the whole
// vault into a downloadable JSON file (lib/saveFile.ts); the scenario list
// imports those files back. Same function names as before — consumers keep
// calling this module.
// Contract: REDIS_API.md → "Scenario Lifecycle — Named Save Slots".

"use client";

import { v7 as uuidv7 } from "uuid";
import { useGameSavesStore, type ScenarioMeta, type ScenarioMemoryBlob } from "@/stores/game-saves";
import { classifyError } from "@/utilities/errorHandler";

export const MAX_SCENARIOS = 20;
export const AUTOSAVE_EVERY_TURNS = 10;

export type { ScenarioMeta, ScenarioMemoryBlob };

export type EntryDecision =
  | { action: "resume"; scenario: ScenarioMeta }
  | { action: "restore"; scenario: ScenarioMeta }
  | { action: "create" };

const store = useGameSavesStore;

export function listScenarios(): ScenarioMeta[] {
  return [...store.getState().scenarios].sort((a, b) => b.last_played_at - a.last_played_at);
}

export function getScenario(id: string): ScenarioMeta | null {
  return store.getState().scenarios.find((s) => s.id === id) ?? null;
}

function buildScenario(id: string, name: string): ScenarioMeta {
  return {
    id,
    name: name.trim() || "Unnamed Adventure",
    created_at: Date.now(),
    last_played_at: Date.now(),
  };
}

function addScenario(scenario: ScenarioMeta): ScenarioMeta | null {
  const st = store.getState();
  if (st.scenarios.length >= MAX_SCENARIOS) {
    console.warn(`[Scenarios] Registry full (${MAX_SCENARIOS}); refusing to create`);
    return null;
  }
  st.upsertScenario(scenario);
  return scenario;
}

export function createScenario(name: string): ScenarioMeta | null {
  return addScenario(buildScenario(uuidv7(), name));
}

/**
 * Creates a scenario whose id is chosen by the caller — used when a play
 * session is seeded from a catalog game (sid comes from the session creation
 * step, not from this registry). Idempotent: an existing entry is returned as-is.
 */
export function createScenarioWithId(id: string, name: string): ScenarioMeta | null {
  return getScenario(id) ?? addScenario(buildScenario(id, name));
}

export function renameScenario(id: string, name: string): ScenarioMeta | null {
  const existing = getScenario(id);
  if (!existing) return null;
  const updated = { ...existing, name: name.trim() || existing.name };
  store.getState().upsertScenario(updated);
  return updated;
}

export function touchScenario(id: string): void {
  const existing = getScenario(id);
  if (!existing) return;
  store.getState().upsertScenario({ ...existing, last_played_at: Date.now() });
}

export function deleteScenario(id: string): void {
  // removeScenario also drops the slot's memory blob and turn entry.
  store.getState().removeScenario(id);
}

// --- memory blob (exported vectors) ---

export function saveMemory(id: string, blob: ScenarioMemoryBlob): boolean {
  if (blob.sid !== id || !Array.isArray(blob.chunks)) {
    const classified = classifyError(
      new Error(`Memory blob for ${id} is malformed (sid mismatch or chunks missing)`),
      "scenarios.saveMemory.shape",
    );
    console.error("[Scenarios] Failed to save memory blob:", classified.message);
    return false;
  }
  store.getState().setMemory(blob);
  return true;
}

export function loadMemory(id: string): ScenarioMemoryBlob | null {
  return store.getState().memories[id] ?? null;
}

export function clearMemory(id: string): void {
  store.getState().removeMemory(id);
}

// --- entry decision (single pass — see LOOPS.md §4.3) ---

export function resolveEntry(scenarioId: string | null): EntryDecision {
  const scenario = scenarioId ? getScenario(scenarioId) : null;
  if (!scenario) return { action: "create" };

  const blob = loadMemory(scenario.id);
  const hasSavedMemory = Boolean(blob && blob.chunks.length > 0);
  return hasSavedMemory
    ? { action: "restore", scenario }
    : { action: "resume", scenario };
}

// --- autosave cadence ---

export function shouldAutosave(turnNumber: number): boolean {
  return turnNumber > 0 && turnNumber % AUTOSAVE_EVERY_TURNS === 0;
}

// --- persisted turn (single call: memory blob + registry touch + turn count) ---

export function readTurn(id: string): number {
  return store.getState().turns[id] ?? 0;
}

export function writeTurn(id: string, turn: number): void {
  store.getState().setTurn(id, turn);
}

export function persistScenarioTurn(
  id: string,
  blob: ScenarioMemoryBlob,
  turn: number
): void {
  saveMemory(id, blob);
  touchScenario(id);
  writeTurn(id, turn);
}
