"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  deleteScenario,
  MAX_SCENARIOS,
  type ScenarioMemoryBlob,
  type ScenarioMeta,
} from "@/lib/scenarios";
import { readSavesFile } from "@/lib/saveFile";
import { useGameSavesStore } from "@/stores/game-saves";
import { errorToast, successToast } from "@/ui/notifications";

interface ScenarioEntryProps {
  onEnter: (scenario: ScenarioMeta, restore: boolean) => void;
}

export default function ScenarioEntry({ onEnter }: ScenarioEntryProps) {
  // The vault is a zustand store — this list stays live with it.
  const scenarios = useGameSavesStore((s) => s.scenarios);
  const memories = useGameSavesStore((s) => s.memories);
  const importSnapshot = useGameSavesStore((s) => s.importSnapshot);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const sorted = useMemo(
    () => [...scenarios].sort((a, b) => b.last_played_at - a.last_played_at),
    [scenarios]
  );

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const snapshot = await readSavesFile(file);
      if (!snapshot) {
        errorToast("Import failed", "That doesn't look like a Deepslate save file.");
        return;
      }
      importSnapshot(snapshot, MAX_SCENARIOS);
      successToast(
        "Imported",
        `${snapshot.scenarios.length} adventures and ${snapshot.memories.length} memory blobs loaded.`
      );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-center font-display text-3xl text-accent">Deepslate Dungeons</h1>
      <p className="mt-2 text-center text-sm text-text-muted">
        Continue an adventure, or forge a new world first
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-bg-base/60 shadow-lg shadow-black/20">
        {sorted.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-text-muted">No saved adventures yet.</p>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {sorted.map((s) => {
            const blob: ScenarioMemoryBlob | undefined = memories[s.id];
            const mode = blob && blob.chunks.length > 0 ? "Restore memory" : "Continue";
            return (
              <li key={s.id} className="flex items-center gap-3 px-5 py-4">
                <button
                  onClick={() => onEnter(s, blob?.chunks.length ? true : false)}
                  className="min-w-0 flex-1 text-left transition-colors hover:text-accent"
                >
                  <span className="block truncate text-base font-medium text-text-secondary">{s.name}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {mode} · {new Date(s.last_played_at).toLocaleString()}
                  </span>
                </button>
                <button
                  onClick={() => deleteScenario(s.id)}
                  className="rounded-md px-2 py-1 text-xs text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${s.name}`}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Link
        href="/inventory"
        className="mt-4 block w-full rounded-[10px] border border-dashed border-accent/40 px-5 py-3 text-center text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/5"
      >
        + Forge a new world
      </Link>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="mt-2 block w-full rounded-[10px] px-5 py-3 text-center text-sm text-text-muted transition-colors hover:text-text-secondary disabled:opacity-40"
      >
        {importing ? "Importing…" : "Have a save file? Import it"}
      </button>
    </div>
  );
}
