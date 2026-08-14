"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScenarioMeta } from "@/lib/scenarios";
import {
  clearMemory,
  loadMemory,
  saveMemory,
  shouldAutosave,
  touchScenario,
} from "@/lib/scenarios";
import * as play from "@/lib/playClient";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface PlayScreenProps {
  sid: string;
  scenario: ScenarioMeta;
}

const TURN_KEY = "rpg:turn:";
const READY_KEY = "rpg:ready:";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 60; // ~2 min budget

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function PlayScreen({ sid, scenario }: PlayScreenProps) {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [sealed, setSealed] = useState(true);

  const turnRef = useRef(readJson<number>(TURN_KEY + sid) ?? 0);
  const lastConsumedRef = useRef<string | null>(readJson<string>(READY_KEY + sid) ?? null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const turn = turnRef.current;

  const persistTurn = useCallback(() => {
    localStorage.setItem(TURN_KEY + sid, String(turnRef.current));
  }, [sid]);

  const autosave = useCallback(
    async (mark: number) => {
      try {
        const blob = await play.memoryExport(sid);
        if (!blob.chunks.length) return;
        saveMemory(sid, { sid, saved_at: blob.saved_at, last_turn: mark, chunks: blob.chunks });
        touchScenario(sid);
        persistTurn();
      } catch (e) {
        console.error("[Play] autosave failed:", e);
      }
    },
    [sid, persistTurn],
  );

  // Restore memory back into the shared index if the slot has a saved blob.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const blob = loadMemory(sid);
      if (blob && blob.chunks.length > 0) {
        try {
          await play.memoryRestore(sid, blob.chunks);
          if (!cancelled) setSealed(false);
          return;
        } catch (e) {
          console.error("[Play] restore failed:", e);
        }
      }
      if (!cancelled) setSealed(false);
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sid]);

  const pollForOutput = useCallback(
    (prompt: string) => {
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        try {
          const out = await play.outputGet(sid);
          const story = out?.story && String(out.story).trim();
          if (story && story !== lastConsumedRef.current) {
            if (pollRef.current) clearInterval(pollRef.current);
            lastConsumedRef.current = story;
            localStorage.setItem(READY_KEY + sid, JSON.stringify(story));
            setMessages((prev) => [
              ...prev.filter((m) => !(m.role === "assistant" && m.text === "…")),
              { role: "assistant", text: story },
            ]);
            turnRef.current += 1;
            persistTurn();
            if (shouldAutosave(turnRef.current)) {
              void autosave(turnRef.current);
            }
            setBusy(false);
          }
        } catch (e) {
          // still polling; engine may be mid-write
          console.error("[Play] poll error:", e);
        }
        if (tries >= POLL_MAX_TRIES) {
          if (pollRef.current) clearInterval(pollRef.current);
          setBusy(false);
          setError("The AI server didn't respond in time. It may be offline — check it's running on :8000.");
        }
      }, POLL_INTERVAL_MS);
    },
    [sid, autosave, persistTurn],
  );

  async function send(promptText: string) {
    const text = promptText.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);

    try {
      await play.queuePush(sid, { sid, prompt: text, turn: turnRef.current + 1 });
      await stateSet(sid, text);
      await play.counterIncr(sid);
      if (pollRef.current) clearInterval(pollRef.current);
      pollForOutput(text);
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error
          ? `${e.message} — is the AI server running on :8000?`
          : "Failed to send your action.",
      );
    }
  }

  async function stateSet(sid: string, text: string) {
    try {
      await play.stateSetField(sid, "prompt_history", text);
    } catch {
      /* state is best-effort; queue is the source of truth */
    }
  }

  async function onSave() {
    if (busy) return;
    setExitOpen(false);
    const blob = await play.memoryExport(sid);
    if (blob.chunks.length) {
      saveMemory(sid, { sid, saved_at: blob.saved_at, last_turn: turnRef.current, chunks: blob.chunks });
      touchScenario(sid);
      persistTurn();
    }
    router.push("/play");
  }

  async function onDiscard() {
    if (busy) return;
    setExitOpen(false);
    try {
      await play.memoryClear(sid);
    } catch {
      /* best-effort wipe */
    }
    clearMemory(sid);
    router.push("/play");
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between border-b border-border py-4">
        <div>
          <h1 className="font-serif text-lg text-accent">{scenario.name}</h1>
          <p className="text-xs text-text-muted">Turn {turn}</p>
        </div>
        <button
          onClick={() => setExitOpen(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Exit
        </button>
      </header>

      <div ref={logRef} className="flex-1 space-y-4 overflow-y-auto py-5">
        {messages.length === 0 && !busy && (
          <p className="pt-10 text-center text-sm text-text-muted">
            Right-click lure of the deep: type an action to begin your tale.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-accent text-background"
                : "border border-border bg-background/60 text-text-secondary"
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
            onClick={() => setError(null)}
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
          >
            {error}
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2 border-t border-border py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || sealed}
          placeholder={sealed ? "Restoring memory…" : "What do you do?"}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || sealed || !input.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>

      {exitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-2xl">
            <h2 className="font-serif text-lg text-text-secondary">Save this adventure?</h2>
            <p className="mt-1 text-sm text-text-muted">
              Your tale is preserved in the vault and memory is kept for a future visit.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => void onSave()}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90"
              >
                Save &amp; Exit
              </button>
              <button
                onClick={() => void onDiscard()}
                className="rounded-lg border border-destructive/40 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
              >
                Don&apos;t Save
              </button>
              <button
                onClick={() => setExitOpen(false)}
                className="rounded-lg px-4 py-2.5 text-sm text-text-muted hover:text-text-secondary"
              >
                Keep Playing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}