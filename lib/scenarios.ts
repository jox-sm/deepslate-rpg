// lib/scenarios.ts — Named save slots (scenario lifecycle)
// localStorage keys: rpg:scenarios (registry), rpg:memory:{id} (exported search-memory blob)
// Contract: REDIS_API.md → "Scenario Lifecycle — Named Save Slots"

"use client";

import { v7 as uuidv7 } from "uuid";
import type { AiMemoryChunk } from "@/types/ai-server";

export const SCENARIOS_KEY = "rpg:scenarios";
export const MAX_SCENARIOS = 20;
export const AUTOSAVE_EVERY_TURNS = 10;
export const LOCALSTORAGE_BUDGET_BYTES = 4_000_000; // stay under the 5MB quota

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

export type EntryDecision =
  | { action: "resume"; scenario: ScenarioMeta }
  | { action: "restore"; scenario: ScenarioMeta }
  | { action: "create" };

const memoryKey = (id: string) => `rpg:memory:${id}`;

function readRegistry(): ScenarioMeta[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScenarioMeta[]) : [];
  } catch {
    return [];
  }
}

function writeRegistry(registry: ScenarioMeta[]): void {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(registry));
  } catch (error) {
    console.error("[Scenarios] Failed to persist registry:", error);
  }
}

export function listScenarios(): ScenarioMeta[] {
  return readRegistry().sort((a, b) => b.last_played_at - a.last_played_at);
}

export function getScenario(id: string): ScenarioMeta | null {
  return readRegistry().find((s) => s.id === id) ?? null;
}

export function createScenario(name: string): ScenarioMeta | null {
  const registry = readRegistry();
  if (registry.length >= MAX_SCENARIOS) {
    console.warn(`[Scenarios] Registry full (${MAX_SCENARIOS}); refusing to create`);
    return null;
  }
  const scenario: ScenarioMeta = {
    id: uuidv7(),
    name: name.trim() || "Unnamed Adventure",
    created_at: Date.now(),
    last_played_at: Date.now(),
  };
  writeRegistry([...registry, scenario]);
  return scenario;
}

export function renameScenario(id: string, name: string): ScenarioMeta | null {
  const registry = readRegistry();
  const idx = registry.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  registry[idx] = { ...registry[idx], name: name.trim() || registry[idx].name };
  writeRegistry(registry);
  return registry[idx];
}

export function touchScenario(id: string): void {
  const registry = readRegistry();
  const idx = registry.findIndex((s) => s.id === id);
  if (idx === -1) return;
  registry[idx] = { ...registry[idx], last_played_at: Date.now() };
  writeRegistry(registry);
}

export function deleteScenario(id: string): void {
  writeRegistry(readRegistry().filter((s) => s.id !== id));
  clearMemory(id);
}

// --- memory blob (exported vectors) ---

export function saveMemory(id: string, blob: ScenarioMemoryBlob): boolean {
  try {
    const serialized = JSON.stringify(blob);
    if (serialized.length > LOCALSTORAGE_BUDGET_BYTES) {
      console.warn(
        `[Scenarios] Memory blob for ${id} exceeds budget (${serialized.length} bytes) — skipping save`
      );
      return false;
    }
    localStorage.setItem(memoryKey(id), serialized);
    return true;
  } catch (error) {
    console.error("[Scenarios] Failed to save memory blob:", error);
    return false;
  }
}

export function loadMemory(id: string): ScenarioMemoryBlob | null {
  try {
    const raw = localStorage.getItem(memoryKey(id));
    return raw ? (JSON.parse(raw) as ScenarioMemoryBlob) : null;
  } catch {
    return null;
  }
}

export function clearMemory(id: string): void {
  try {
    localStorage.removeItem(memoryKey(id));
  } catch {}
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
