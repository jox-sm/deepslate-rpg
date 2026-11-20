"use client";

interface ExitModalProps {
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function ExitModal({ onSave, onDiscard, onClose }: ExitModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-base p-6 shadow-2xl">
        <h2 className="font-display text-lg text-text-secondary">Save this adventure?</h2>
        <p className="mt-1 text-sm text-text-muted">
          Memory is kept in the vault and on the AI server for a future visit.
          Use the header&apos;s <span className="text-accent">Save</span> button to download
          a JSON snapshot of your runs.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onSave}
            className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-charcoal-950 hover:opacity-90"
          >
            Save &amp; Exit
          </button>
          <button
            onClick={onDiscard}
            className="rounded-[10px] border border-destructive/40 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Don&apos;t Save
          </button>
          <button
            onClick={onClose}
            className="rounded-[10px] px-4 py-2.5 text-sm text-text-muted hover:text-text-secondary"
          >
            Keep Playing
          </button>
        </div>
      </div>
    </div>
  );
}
