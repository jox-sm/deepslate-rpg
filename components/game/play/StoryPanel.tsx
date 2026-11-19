"use client";

import { useRef } from "react";
import type { Message } from "./types";

interface StoryPanelProps {
  messages: Message[];
  busy: boolean;
  error: string | null;
  onDismissError: () => void;
}

export function StoryPanel({ messages, busy, error, onDismissError }: StoryPanelProps) {
  // Present in the original component (assigned but never read) — kept so the
  // rendered DOM is identical.
  const logRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={logRef} className="flex-1 space-y-4 overflow-y-auto py-5">
      {messages.length === 0 && !busy && (
        <p className="pt-10 text-center text-sm text-text-muted">
          The tale begins with a single action. What do you do?
        </p>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
            m.role === "user"
              ? "ml-auto bg-accent text-charcoal-950"
              : "border border-border bg-bg-base/60 text-text-secondary"
          }`}
        >
          {m.text}
        </div>
      ))}
      {busy && (
        <div className="flex items-center gap-2 px-1 text-sm text-text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          The depths stir…
        </div>
      )}
      {error && (
        <button
          onClick={onDismissError}
          className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
        >
          {error}
        </button>
      )}
    </div>
  );
}
