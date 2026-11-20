"use client";

interface PlayHeaderProps {
  name: string;
  turn: number;
  savingFile: boolean;
  onSaveFile: () => void;
  onExit: () => void;
}

export function PlayHeader({ name, turn, savingFile, onSaveFile, onExit }: PlayHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border py-4">
      <div>
        <h1 className="font-display text-lg text-accent">{name}</h1>
        <p className="text-xs text-text-muted">Turn {turn}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSaveFile}
          disabled={savingFile}
          className="rounded-[10px] border border-accent/50 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
        >
          {savingFile ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onExit}
          className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Exit
        </button>
      </div>
    </header>
  );
}
