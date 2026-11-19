"use client";

interface MoveInputProps {
  input: string;
  onInputChange: (value: string) => void;
  busy: boolean;
  sealed: boolean;
  onSubmit: () => void;
}

export function MoveInput({ input, onInputChange, busy, sealed, onSubmit }: MoveInputProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex gap-2 border-t border-border py-3"
    >
      <input
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={busy || sealed}
        placeholder={sealed ? "Restoring memory…" : "What do you do?"}
        className="min-w-0 flex-1 rounded-[10px] border border-border bg-bg-base px-4 py-2.5 text-sm text-text-secondary outline-none focus:border-accent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={busy || sealed || !input.trim()}
        className="rounded-[10px] bg-accent px-5 py-2.5 text-sm font-semibold text-charcoal-950 transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
