import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listScenarios,
  getScenario,
  createScenario,
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

function blob(overrides: Partial<ScenarioMemoryBlob> = {}): ScenarioMemoryBlob {
  return {
    sid: "s1",
    saved_at: Date.now(),
    last_turn: 3,
    chunks: [{ text: "hello", score: 1 }],
    ...overrides,
  } as ScenarioMemoryBlob;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("scenario registry", () => {
  it("creates and lists scenarios", () => {
    const a = createScenario("First")!;
    const b = createScenario("Second")!;
    expect(listScenarios().map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    expect(getScenario(a.id)?.name).toBe("First");
  });

  it("falls back to Unnamed Adventure on blank names", () => {
    expect(createScenario("   ")?.name).toBe("Unnamed Adventure");
  });

  it("refuses creation past MAX_SCENARIOS", () => {
    for (let i = 0; i < MAX_SCENARIOS; i++) createScenario(`S${i}`);
    expect(createScenario("overflow")).toBeNull();
    expect(listScenarios()).toHaveLength(MAX_SCENARIOS);
  });

  it("renames and ignores unknown ids", () => {
    const s = createScenario("Old")!;
    expect(renameScenario(s.id, "New")?.name).toBe("New");
    expect(renameScenario("nope", "X")).toBeNull();
  });

  it("touch bumps last_played_at", () => {
    const s = createScenario("T")!;
    const before = getScenario(s.id)!.last_played_at;
    touchScenario(s.id);
    expect(getScenario(s.id)!.last_played_at).toBeGreaterThanOrEqual(before);
  });

  it("delete removes scenario and its memory", () => {
    const s = createScenario("Gone")!;
    saveMemory(s.id, blob({ sid: s.id }));
    deleteScenario(s.id);
    expect(getScenario(s.id)).toBeNull();
    expect(loadMemory(s.id)).toBeNull();
  });

  it("survives corrupted registry JSON", () => {
    localStorage.setItem("rpg:scenarios", "{broken");
    expect(listScenarios()).toEqual([]);
    expect(getScenario("x")).toBeNull();
  });
});

describe("memory blobs", () => {
  it("round-trips a blob", () => {
    expect(saveMemory("a", blob())).toBe(true);
    expect(loadMemory("a")?.last_turn).toBe(3);
  });

  it("refuses blobs over budget", () => {
    const big = blob({ chunks: [{ text: "x".repeat(5_000_000), score: 1 }] });
    expect(saveMemory("big", big)).toBe(false);
  });

  it("clearMemory removes the blob", () => {
    saveMemory("c", blob());
    clearMemory("c");
    expect(loadMemory("c")).toBeNull();
  });
});

describe("resolveEntry", () => {
  it("creates when no scenario", () => {
    expect(resolveEntry(null)).toEqual({ action: "create" });
    expect(resolveEntry("missing")).toEqual({ action: "create" });
  });

  it("resumes without memory, restores with memory", () => {
    const s = createScenario("Adv")!;
    expect(resolveEntry(s.id)).toMatchObject({ action: "resume" });
    saveMemory(s.id, blob({ sid: s.id }));
    expect(resolveEntry(s.id)).toMatchObject({ action: "restore" });
  });
});

describe("turns and autosave", () => {
  it("reads 0 by default and round-trips writes", () => {
    expect(readTurn("t")).toBe(0);
    writeTurn("t", 7);
    expect(readTurn("t")).toBe(7);
  });

  it("persists memory + touch + turn in one call", () => {
    const s = createScenario("P")!;
    persistScenarioTurn(s.id, blob({ sid: s.id }), 12);
    expect(loadMemory(s.id)?.last_turn).toBe(3);
    expect(readTurn(s.id)).toBe(12);
  });

  it("autosaves every N turns, never on turn 0", () => {
    expect(shouldAutosave(0)).toBe(false);
    expect(shouldAutosave(AUTOSAVE_EVERY_TURNS)).toBe(true);
    expect(shouldAutosave(AUTOSAVE_EVERY_TURNS + 1)).toBe(false);
  });
});
