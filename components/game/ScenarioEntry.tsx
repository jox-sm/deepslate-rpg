"use client";

import { useMemo, useState } from "react";
import {
  ScenarioMemoryBlob,
  createScenario,
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
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

  const withMemory = useMemo(() => {
    const map = new Map<string, ScenarioMemoryBlob | null>();
    for (const s of scenarios) map.set(s.id, loadMemory(s.id));
    return map;
  }, [scenarios]);

  function handleCreate() {
    const scenario = createScenario(name);
    if (!scenario) return;
    setScenarios(listScenarios());
    setName("");
    setShowNew(false);
    onEnter(scenario, false);
  }

  function handleDelete(id: string) {
    deleteScenario(id);
    setScenarios(listScenarios());
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-center font-serif text-3xl text-accent">Deepslate Dungeons</h1>
      <p className="mt-2 text-center text-sm text-text-muted">
        Continue an adventure, or forge a new one
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-background/60 shadow-lg shadow-black/20">
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

      {showNew ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="mt-4 flex gap-2"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adventure name (e.g. The Sunken Vault)"
            maxLength={60}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNew(false)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-muted hover:text-text-secondary"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="mt-4 w-full rounded-lg border border-dashed border-accent/40 px-5 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/5"
        >
          + New Adventure
        </button>
      )}
    </div>
  );
}