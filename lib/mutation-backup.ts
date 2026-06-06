import type { GamePatch } from "@/types/patches";

const STORAGE_PREFIX = "patches:";

interface BackupEntry {
  patches: GamePatch[];
  timestamp: number;
}

export function backupPatches(gameId: string, patches: GamePatch[]): void {
  try {
    const entry: BackupEntry = { patches, timestamp: Date.now() };
    localStorage.setItem(`${STORAGE_PREFIX}${gameId}`, JSON.stringify(entry));
  } catch {
    console.warn("[MutationBackup] localStorage write failed");
  }
}

export function restorePatches(gameId: string): GamePatch[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gameId}`);
    if (!raw) return null;
    const entry: BackupEntry = JSON.parse(raw);
    return entry.patches;
  } catch {
    return null;
  }
}

export function clearBackup(gameId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${gameId}`);
  } catch {
    console.warn("[MutationBackup] localStorage remove failed");
  }
}
