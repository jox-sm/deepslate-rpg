// lib/saveFile.ts — the Save mechanic.
//
// "Save" snapshots the whole in-memory save vault (scenarios + AI memory blobs
// + turn counters) into a versioned JSON file and triggers a browser download.
// Imported back via the scenario list to regain a run. The vault state queried
// here is zustand (stores/game-saves.ts); the memory CONTENT can be refreshed
// from the AI server first (play.memoryExport → Upstash Search) — the file is
// authoritative once downloaded.
//
// File schema:
//   { kind: "deepslate-saves", version: 1, exported_at: <ms>,
//     scenarios: ScenarioMeta[], memories: ScenarioMemoryBlob[],
//     turns: Record<sid, number> }

"use client";

import {
  useGameSavesStore,
  type ScenarioMeta,
  type ScenarioMemoryBlob,
} from "@/stores/game-saves";
import type { AiMemoryChunk } from "@/types/ai-server";

export const SAVES_FILE_KIND = "deepslate-saves";
export const SAVES_FILE_VERSION = 1;
export const SAVES_FILE_PREFIX = "deepslate-saves";

export interface SavesFileSnapshot {
  kind: typeof SAVES_FILE_KIND;
  version: number;
  exported_at: number;
  scenarios: ScenarioMeta[];
  memories: ScenarioMemoryBlob[];
  turns: Record<string, number>;
}

export function buildSavesSnapshot(exportedAt: number = Date.now()): SavesFileSnapshot {
  const { scenarios, memories, turns } = useGameSavesStore.getState();
  return {
    kind: SAVES_FILE_KIND,
    version: SAVES_FILE_VERSION,
    exported_at: exportedAt,
    scenarios: [...scenarios],
    memories: Object.values(memories),
    turns: { ...turns },
  };
}

function defaultFileName(exportedAt: number): string {
  const d = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${SAVES_FILE_PREFIX}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

/** Serializes + downloads the snapshot; returns the file name used. */
export function downloadSavesFile(snapshot: SavesFileSnapshot, fileName?: string): string {
  const name = fileName ?? defaultFileName(snapshot.exported_at);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return name;
}

/** Reads + validates a save file. Returns null on malformed input. */
export async function readSavesFile(file: File): Promise<SavesFileSnapshot | null> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== "object") return null;
    const snap = parsed as Partial<SavesFileSnapshot>;
    if (snap.kind !== SAVES_FILE_KIND) return null;
    if (typeof snap.version !== "number" || snap.version > SAVES_FILE_VERSION) return null;
    if (!Array.isArray(snap.scenarios) || !Array.isArray(snap.memories)) return null;
    if (typeof snap.exported_at !== "number") return null;
    // Shapes are re-validated on import (stores/game-saves.importSnapshot);
    // here we only guarantee the array/record containers exist.
    return {
      kind: SAVES_FILE_KIND,
      version: snap.version,
      exported_at: snap.exported_at,
      scenarios: snap.scenarios as ScenarioMeta[],
      memories: snap.memories as ScenarioMemoryBlob[],
      turns: snap.turns ?? {},
    };
  } catch (error) {
    console.error("[saveFile] read failed:", error);
    return null;
  }
}

/** Defensive shape guard used by import UI code before hitting the store. */
export function isMemoryBlob(value: unknown): value is ScenarioMemoryBlob {
  const b = value as ScenarioMemoryBlob | null;
  if (!b || typeof b !== "object") return false;
  return (
    typeof b.sid === "string" &&
    typeof b.saved_at === "number" &&
    typeof b.last_turn === "number" &&
    Array.isArray(b.chunks) &&
    b.chunks.every(
      (c: unknown) =>
        !!c &&
        typeof c === "object" &&
        typeof (c as AiMemoryChunk).id === "string" &&
        typeof (c as AiMemoryChunk).content === "object",
    )
  );
}
