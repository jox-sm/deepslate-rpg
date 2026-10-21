"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ScenarioMemoryBlob,
  deleteScenario,
  listScenarios,
  loadMemory,
  type ScenarioMeta,
} from "@/lib/scenarios";

interface ScenarioEntryProps {
  onEnter: (scenario: ScenarioMeta, restore: boolean) => void;
}

export default function ScenarioEntry({ onEnter }: ScenarioEntryProps) {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>(() => listScenarios());

  const withMemory = useMemo(() => {
    const map = new Map<string, ScenarioMemoryBlob | null>();
    for (const s of scenarios) map.set(s.id, loadMemory(s.id));
    return map;
  }, [scenarios]);

  function handleDelete(id: string) {
    deleteScenario(id);
    setScenarios(listScenarios());
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-center font-display text-3xl text-accent">Deepslate Dungeons</h1>
      <p className="mt-2 text-center text-sm text-text-muted">
        Continue an adventure, or forge a new world first
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-bg-base/60 shadow-lg shadow-black/20">
        {scenarios.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-text-muted">No saved adventures yet.</p>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {scenarios.map((s) => {
            const blob = withMemory.get(s.id);
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
                  onClick={() => handleDelete(s.id)}
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
    </div>
  );
}