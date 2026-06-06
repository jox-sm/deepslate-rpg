"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GamePatch, GamePatchResult, GameArrayKey } from "@/types/patches";
import { backupPatches, restorePatches, clearBackup } from "@/lib/mutation-backup";
import { v7 as uuidv7 } from "uuid";

const BACKUP_INTERVAL_MS = 600_000;

interface UseMutationTrackerReturn {
  patches: GamePatch[];
  recordAdd: (key: GameArrayKey, value: object) => void;
  recordRemove: (key: GameArrayKey, id: string) => void;
  recordReplace: (key: GameArrayKey, id: string, field: string, value: unknown) => void;
  save: () => Promise<{ success: boolean; results?: GamePatchResult[] }>;
  discard: () => void;
  dirty: boolean;
  saving: boolean;
  lastSaveResult: GamePatchResult[] | null;
}

export function useMutationTracker(gameId: string): UseMutationTrackerReturn {
  const [patches, setPatches] = useState<GamePatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<GamePatchResult[] | null>(null);
  const patchesRef = useRef(patches);

  useEffect(() => {
    patchesRef.current = patches;
  });

  useEffect(() => {
    const saved = restorePatches(gameId);
    if (saved && saved.length > 0) {
      const ok = window.confirm("You have unsaved changes. Restore them?");
      if (ok) {
        queueMicrotask(() => setPatches(saved));
      } else {
        clearBackup(gameId);
      }
    }
  }, [gameId]);

  useEffect(() => {
    if (patches.length === 0) return;
    const timer = setInterval(() => {
      backupPatches(gameId, patchesRef.current);
    }, BACKUP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [gameId, patches.length]);

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (patchesRef.current.length > 0) {
      backupPatches(gameId, patchesRef.current);
      e.preventDefault();
      e.returnValue = "";
    }
  }, [gameId]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);

  const recordAdd = useCallback((key: GameArrayKey, value: object) => {
    setPatches((prev) => [...prev, { op: "add", path: `/${key}/-`, value } as GamePatch]);
  }, []);

  const recordRemove = useCallback((key: GameArrayKey, id: string) => {
    setPatches((prev) => [...prev, { op: "remove", path: `/${key}/${id}` } as GamePatch]);
  }, []);

  const recordReplace = useCallback((key: GameArrayKey, id: string, field: string, value: unknown) => {
    setPatches((prev) => [...prev, { op: "replace", path: `/${key}/${id}/${field}`, value } as GamePatch]);
  }, []);

  const save = useCallback(async () => {
    if (patchesRef.current.length === 0) return { success: true };
    setSaving(true);
    try {
      const idempotencyKey = uuidv7();
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/patches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": idempotencyKey },
        body: JSON.stringify({ patches: patchesRef.current }),
      });
      const json = await res.json();
      const results: GamePatchResult[] = json.data?.results ?? [];
      const allApplied = results.every((r: GamePatchResult) => r.status === "applied");
      if (allApplied) {
        setPatches([]);
        clearBackup(gameId);
      }
      setLastSaveResult(results);
      return { success: allApplied, results };
    } catch {
      return { success: false };
    } finally {
      setSaving(false);
    }
  }, [gameId]);

  const discard = useCallback(() => {
    setPatches([]);
    clearBackup(gameId);
  }, [gameId]);

  return {
    patches,
    recordAdd,
    recordRemove,
    recordReplace,
    save,
    discard,
    dirty: patches.length > 0,
    saving,
    lastSaveResult,
  };
}
