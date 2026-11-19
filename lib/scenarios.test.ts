import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listScenarios,
  getScenario,
  createScenario,
  createScenarioWithId,
  renameScenario,
  touchScenario,
  deleteScenario,
  saveMemory,
  loadMemory,
  clearMemory,
  resolveEntry,
  shouldAutosave,
  readTurn,
  writeTurn,
  persistScenarioTurn,
  MAX_SCENARIOS,
  AUTOSAVE_EVERY_TURNS,
  type ScenarioMemoryBlob,
} from "./scenarios";
import { useGameSavesStore } from "@/stores/game-saves";
import type { AiMemoryChunk } from "@/types/ai-server";

function chunk(id: string): AiMemoryChunk {
  return { id, content: { text: "story so far" }, metadata: null };
}

function blob(sid: string, overrides: Partial<ScenarioMemoryBlob> = {}): ScenarioMemoryBlob {
  return {
    sid,
    saved_at: Date.now(),
    last_turn: 3,
    chunks: [chunk(`${sid}-c1`)],
    ...overrides,
  };
}

beforeEach(() => {
  // The vault is module-scoped zustand state; every test starts empty.
  useGameSavesStore.getState().resetForTests();
  vi.restoreAllMocks();
});

describe("scenario registry", () => {
  it("creates and lists scenarios, newest-played first", () => {
    const a = createScenario("First")!;
    const b = createScenario("Second")!;
    touchScenario(a.id); // a is now the most recent
    const listed = listScenarios();
    expect(listed.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(getScenario(a.id)?.name).toBe("First");
  });

  it("creates a scenario with a caller-chosen id, idempotently", () => {
    const first = createScenarioWithId("catalog-game-42", "Dusk Vault");
    const second = createScenarioWithId("catalog-game-42", "Dusk Vault");
    expect(second).toEqual(first);
    expect(listScenarios()).toHaveLength(1);
    expect(getScenario("catalog-game-42")?.name).toBe("Dusk Vault");
  });

  it("renames and touches", () => {
    const s = createScenario("Old")!;
    const renamed = renameScenario(s.id, "New")!;
    expect(renamed.name).toBe("New");
    expect(getScenario(s.id)?.name).toBe("New");
    // keep meaningful name on blank rename
    expect(renameScenario(s.id, "   ")?.name).toBe("New");

    const before = getScenario(s.id)!.last_played_at;
    touchScenario(s.id);
    expect(getScenario(s.id)!.last_played_at).toBeGreaterThanOrEqual(before);
  });

  it("refuses to create past the slot budget", () => {
    for (let i = 0; i < MAX_SCENARIOS; i += 1) {
      expect(createScenario(`Slot ${i}`)).not.toBeNull();
    }
    expect(createScenario("One Too Many")).toBeNull();
    expect(listScenarios()).toHaveLength(MAX_SCENARIOS);
  });

  it("deletes a scenario and its memory blob and turn entry", () => {
    const s = createScenario("Doomed")!;
    saveMemory(s.id, blob(s.id));
    writeTurn(s.id, 7);
    deleteScenario(s.id);
    expect(getScenario(s.id)).toBeNull();
    expect(loadMemory(s.id)).toBeNull();
    expect(readTurn(s.id)).toBe(0);
  });
});

describe("memory blob vault", () => {
  it("round-trips a blob", () => {
    const s = createScenario("With Memory")!;
    const b = blob(s.id, { last_turn: 5 });
    expect(saveMemory(s.id, b)).toBe(true);
    expect(loadMemory(s.id)).toEqual(b);
    clearMemory(s.id);
    expect(loadMemory(s.id)).toBeNull();
  });

  it("rejects malformed blobs (sid mismatch, missing chunks)", () => {
    const s = createScenario("Guarded")!;
    expect(saveMemory(s.id, blob("other-session"))).toBe(false);
    expect(saveMemory(s.id, { sid: s.id, saved_at: 1, last_turn: 1, chunks: undefined as unknown as AiMemoryChunk[] })).toBe(false);
    expect(loadMemory(s.id)).toBeNull();
  });

  it("drops blobs for unregistered scenarios (orphans)", () => {
    expect(saveMemory("ghost-session", blob("ghost-session"))).toBe(true);
    expect(loadMemory("ghost-session")).toBeNull();
  });
});

describe("resolveEntry", () => {
  it("creates when no scenario id is given or the slot is unknown", () => {
    expect(resolveEntry(null)).toEqual({ action: "create" });
    expect(resolveEntry("missing")).toEqual({ action: "create" });
  });

  it("resumes without saved memory, restores with it", () => {
    const s = createScenario("Empty")!;
    expect(resolveEntry(s.id)).toEqual({ action: "resume", scenario: getScenario(s.id) });

    saveMemory(s.id, blob(s.id));
    expect(resolveEntry(s.id)).toEqual({ action: "restore", scenario: getScenario(s.id) });

    // an empty blob counts as no memory
    const t = createScenario("Empty Blob")!;
    saveMemory(t.id, blob(t.id, { chunks: [] }));
    expect(resolveEntry(t.id).action).toBe("resume");
  });
});

describe("turn persistence", () => {
  it("readTurn defaults to 0 and writeTurn round-trips", () => {
    const s = createScenario("Counter")!;
    expect(readTurn(s.id)).toBe(0);
    writeTurn(s.id, 12);
    expect(readTurn(s.id)).toBe(12);
  });

  it("persistScenarioTurn writes blob, touch and turn in one call", () => {
    const s = createScenario("Persisted")!;
    const before = getScenario(s.id)!.last_played_at;
    persistScenarioTurn(s.id, blob(s.id, { last_turn: 9 }), 9);
    expect(readTurn(s.id)).toBe(9);
    expect(loadMemory(s.id)?.last_turn).toBe(9);
    expect(getScenario(s.id)!.last_played_at).toBeGreaterThanOrEqual(before);
  });

  it("writes a zero turn without error (reset path)", () => {
    const s = createScenario("Resettable")!;
    writeTurn(s.id, 4);
    writeTurn(s.id, 0);
    expect(readTurn(s.id)).toBe(0);
  });
});

describe("autosave cadence", () => {
  it("fires only on multiples of AUTOSAVE_EVERY_TURNS", () => {
    expect(shouldAutosave(0)).toBe(false);
    expect(shouldAutosave(1)).toBe(false);
    expect(shouldAutosave(AUTOSAVE_EVERY_TURNS)).toBe(true);
    expect(shouldAutosave(2 * AUTOSAVE_EVERY_TURNS)).toBe(true);
    expect(shouldAutosave(AUTOSAVE_EVERY_TURNS - 1)).toBe(false);
    expect(shouldAutosave(15)).toBe(false);
  });
});
