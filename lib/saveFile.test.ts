import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildSavesSnapshot,
  downloadSavesFile,
  readSavesFile,
  SAVES_FILE_KIND,
  SAVES_FILE_VERSION,
  type SavesFileSnapshot,
} from "./saveFile";
import { createScenario, saveMemory, readTurn, writeTurn } from "@/lib/scenarios";
import { useGameSavesStore } from "@/stores/game-saves";

function makeFakeFile(content: string, name = "save.json"): File {
  return new File([content], name, { type: "application/json" });
}

beforeEach(() => {
  useGameSavesStore.getState().resetForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("buildSavesSnapshot", () => {
  it("serializes the whole vault into the versioned schema", () => {
    const s = createScenario("Run One")!;
    saveMemory(s.id, {
      sid: s.id,
      saved_at: 42,
      last_turn: 6,
      chunks: [{ id: "c1", content: {}, metadata: null }],
    });
    writeTurn(s.id, 6);

    const snap = buildSavesSnapshot(1234);
    expect(snap.kind).toBe(SAVES_FILE_KIND);
    expect(snap.version).toBe(SAVES_FILE_VERSION);
    expect(snap.exported_at).toBe(1234);
    expect(snap.scenarios).toHaveLength(1);
    expect(snap.memories).toHaveLength(1);
    expect(snap.turns[s.id]).toBe(6);
  });

  it("copies vault data (snapshot is not a live reference)", () => {
    const s1 = createScenario("Before")!;
    const snap = buildSavesSnapshot();
    createScenario("After");
    expect(snap.scenarios).toHaveLength(1);
    expect(snap.scenarios[0].id).toBe(s1.id);
  });
});

describe("downloadSavesFile", () => {
  it("downloads a pretty-printed JSON blob via an anchor and returns the name", () => {
    const createObjectURL = vi.fn((snapshotBlob: Blob) => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const clicks: Array<{ href: string; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download });
    });

    const snap = buildSavesSnapshot(new Date(2026, 0, 2, 3, 4, 5).getTime());
    const name = downloadSavesFile(snap);

    expect(name).toBe("deepslate-saves-20260102-030405.json");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe(name);
    expect(clicks[0].href).toBe("blob:mock-url");
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

describe("readSavesFile", () => {
  it("round-trips a snapshot through a file", async () => {
    const s = createScenario("Journey")!;
    saveMemory(s.id, { sid: s.id, saved_at: 7, last_turn: 2, chunks: [] });
    writeTurn(s.id, 2);
    const original = buildSavesSnapshot();

    const file = makeFakeFile(JSON.stringify(original));
    const read = await readSavesFile(file);
    expect(read).toEqual(original);

    // Import into a fresh vault and confirm the run is regained.
    useGameSavesStore.getState().resetForTests();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    useGameSavesStore.getState().importSnapshot(read!, 20);
    err.mockRestore();
    const vault = useGameSavesStore.getState();
    expect(vault.scenarios.some((x) => x.id === s.id)).toBe(true);
    expect(vault.memories[s.id]?.saved_at).toBe(7);
    expect(vault.turns[s.id]).toBe(2);
  });

  it("rejects non-JSON, wrong-kind and future-version files", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readSavesFile(makeFakeFile("{not json"))).toBeNull();

    const badKind = { kind: "someone-elses-saves", version: 1, exported_at: 1, scenarios: [], memories: [] };
    expect(await readSavesFile(makeFakeFile(JSON.stringify(badKind)))).toBeNull();

    const future = { ...badKind, kind: SAVES_FILE_KIND, version: SAVES_FILE_VERSION + 1 };
    expect(await readSavesFile(makeFakeFile(JSON.stringify(future)))).toBeNull();
    err.mockRestore();
  });

  it("accepts a snapshot with no turns record", async () => {
    const legacy: Partial<SavesFileSnapshot> = {
      kind: SAVES_FILE_KIND,
      version: SAVES_FILE_VERSION,
      exported_at: 5,
      scenarios: [],
      memories: [],
    };
    expect(await readSavesFile(makeFakeFile(JSON.stringify(legacy)))).not.toBeNull();
  });
});

describe("turn helpers against the vault", () => {
  it("readTurn reflects snapshot imports", () => {
    const s = createScenario("Seed")!;
    writeTurn(s.id, 4);
    const snap = buildSavesSnapshot();
    useGameSavesStore.getState().resetForTests();
    expect(readTurn(s.id)).toBe(0);
    useGameSavesStore.getState().importSnapshot(snap, 20);
    expect(readTurn(s.id)).toBe(4);
  });
});
