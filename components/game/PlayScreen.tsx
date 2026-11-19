"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScenarioMeta } from "@/lib/scenarios";
import {
  clearMemory,
  loadMemory,
  persistScenarioTurn,
  readTurn,
  shouldAutosave,
  writeTurn,
} from "@/lib/scenarios";
import * as play from "@/lib/playClient";
import { takeGameSeed, type GameSeed } from "@/lib/gameSeed";
import { buildSavesSnapshot, downloadSavesFile } from "@/lib/saveFile";
import { classifyError } from "@/utilities/errorHandler";
import { errorToast, successToast } from "@/ui/notifications";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface PlayScreenProps {
  sid: string;
  scenario: ScenarioMeta;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 60; // ~2 min budget
/** Accept-tolerance between the client clock and the engine's output stamps. */
const TS_SKEW_SECONDS = 2;

export default function PlayScreen({ sid, scenario }: PlayScreenProps) {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [sealed, setSealed] = useState(true);
  const [savingFile, setSavingFile] = useState(false);

  const turnRef = useRef(readTurn(sid));
  // Output-consumption markers are mount-local now — saves live in the
  // in-memory vault only (no localStorage). On a fresh mount nothing has been
  // consumed yet, so "is this output new?" is decided against the epoch of
  // THIS session's send (sendEpochRef): anything stamped before it is a
  // leftover from a previous run still sitting in output:{sid}.
  const lastConsumedRef = useRef<string | null>(null);
  const lastSeenTsRef = useRef<number | null>(null);
  const sendEpochRef = useRef<number>(0);
  // Catalog-game seed (if this session was started from a game page); consumed
  // on turn 1 only.
  const seedRef = useRef<GameSeed | null>(takeGameSeed(sid));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const [turn, setTurn] = useState(() => readTurn(sid));

  const autosave = useCallback(
    async (mark: number) => {
      try {
        const blob = await play.memoryExport(sid);
        if (!blob.chunks.length) return;
        persistScenarioTurn(
          sid,
          { sid, saved_at: blob.saved_at, last_turn: mark, chunks: blob.chunks },
          mark
        );
      } catch (e) {
        const classified = classifyError(e, "PlayScreen.autosave");
        console.error("[Play] autosave failed:", classified.message);
      }
    },
    [sid],
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
          const classified = classifyError(e, "PlayScreen.restore");
          console.error("[Play] restore failed:", classified.message);
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
    () => {
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        try {
          const out = await play.outputGet(sid);
          const story = out?.story && String(out.story).trim();
          const outTs = typeof out?.timestamp === "number" ? out.timestamp : 0;
          let isNew: boolean;
          if (outTs > 0) {
            isNew =
              lastSeenTsRef.current === null
                ? outTs >= sendEpochRef.current - TS_SKEW_SECONDS
                : outTs > lastSeenTsRef.current;
          } else {
            // Legacy outputs without a timestamp: string-compare fallback —
            // two identical consecutive stories would otherwise look
            // "already consumed" and hang the client forever.
            isNew = !!story && story !== lastConsumedRef.current;
          }
          if (story && isNew) {
            if (pollRef.current) clearInterval(pollRef.current);
            lastConsumedRef.current = story;
            if (outTs > 0) lastSeenTsRef.current = outTs;
            setMessages((prev) => [
              ...prev.filter((m) => !(m.role === "assistant" && m.text === "…")),
              { role: "assistant", text: story },
            ]);
            turnRef.current += 1;
            setTurn(turnRef.current);
            writeTurn(sid, turnRef.current);
            if (shouldAutosave(turnRef.current)) {
              void autosave(turnRef.current);
            }
            setBusy(false);
          }
        } catch (e) {
          // still polling; engine may be mid-write
          const classified = classifyError(e, "PlayScreen.poll");
          console.error("[Play] poll error:", classified.message);
        }
        if (tries >= POLL_MAX_TRIES) {
          if (pollRef.current) clearInterval(pollRef.current);
          setBusy(false);
          setError("The AI server didn't respond in time. It may be offline — check it's running on :8000.");
        }
      }, POLL_INTERVAL_MS);
    },
    [sid, autosave],
  );

  async function send(promptText: string) {
    const text = promptText.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    // Stamp this send's epoch in seconds (matching the engine's time.time()
    // GameOutput.timestamp) so the poll can reject stale leftovers.
    sendEpochRef.current = Date.now() / 1000;

    try {
      // Canonical AI-server GameRequest payload: { uuid, prompt, data, images, timestamp }.
      // The engine validates against Pydantic GameRequest, which REQUIRES `uuid` —
      // the session id must ride along as `uuid` (the AI server also tolerates `sid`
      // as an alias). Sending `{sid, prompt, turn}` produced poison requests that were
      // dead-lettered instead of processed.
      const turn = turnRef.current + 1;
      const data: Record<string, unknown> = { turn };
      if (turn === 1 && seedRef.current) {
        // Session seeding from a catalog game: one-shot, first request only.
        // world_seed = game id → every session of the same game shares stable
        // terrain; `campaign` is the game's characters/maps/items payload,
        // preserved verbatim into game_data by the engine's turn-1 builder.
        const seed = seedRef.current;
        seedRef.current = null;
        data.world_seed = seed.game_id;
        data.campaign = {
          name: seed.name,
          description: seed.description ?? "",
          characters: seed.characters ?? [],
          maps: seed.maps ?? [],
          items: seed.items ?? [],
        };
      }
      await play.queuePush(sid, {
        uuid: sid,
        prompt: text,
        data,
        images: [],
        timestamp: Date.now(),
      });
      await play.counterIncr(sid);
      if (pollRef.current) clearInterval(pollRef.current);
      pollForOutput();
    } catch (e) {
      setBusy(false);
      const classified = classifyError(e, "PlayScreen.send");
      const message = `${classified.message} — is the AI server running on :8000?`;
      setError(message);
      errorToast("Send failed", message);
    }
  }

  // The "Save" mechanic: refresh this session's memory from the AI server
  // (Redis/Upstash Search) into the vault, then download the whole vault —
  // every scenario, memory blob and turn counter — as a versioned JSON file.
  // Import it back from the scenario list to regain a run.
  async function onSaveFile() {
    if (busy || sealed || savingFile) return;
    setSavingFile(true);
    try {
      const blob = await play.memoryExport(sid);
      if (blob.chunks.length) {
        persistScenarioTurn(
          sid,
          { sid, saved_at: blob.saved_at, last_turn: turnRef.current, chunks: blob.chunks },
          turnRef.current
        );
      }
      const file = downloadSavesFile(buildSavesSnapshot());
      successToast("Saved", `Downloaded ${file}`);
    } catch (e) {
      const classified = classifyError(e, "PlayScreen.saveFile");
      const message = `${classified.message} — is the AI server running on :8000?`;
      setError(message);
      errorToast("Save failed", message);
    } finally {
      setSavingFile(false);
    }
  }

  async function onSave() {
    if (busy) return;
    setExitOpen(false);
    const blob = await play.memoryExport(sid);
    if (blob.chunks.length) {
      persistScenarioTurn(
        sid,
        { sid, saved_at: blob.saved_at, last_turn: turnRef.current, chunks: blob.chunks },
        turnRef.current
      );
    }
    router.push("/play");
  }

  async function onDiscard() {
    if (busy) return;
    setExitOpen(false);
    try {
      await play.memoryClear(sid);
    } catch (e) {
      const classified = classifyError(e, "PlayScreen.discard");
      console.error("[Play] memory clear failed:", classified.message);
    }
    clearMemory(sid);
    router.push("/play");
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between border-b border-border py-4">
        <div>
          <h1 className="font-display text-lg text-accent">{scenario.name}</h1>
          <p className="text-xs text-text-muted">Turn {turn}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void onSaveFile()}
            disabled={savingFile}
            className="rounded-[10px] border border-accent/50 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
          >
            {savingFile ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setExitOpen(true)}
            className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Exit
          </button>
        </div>
      </header>

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
            onClick={() => setError(null)}
            className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
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

      {exitOpen && (
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
                onClick={() => void onSave()}
                className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-charcoal-950 hover:opacity-90"
              >
                Save &amp; Exit
              </button>
              <button
                onClick={() => void onDiscard()}
                className="rounded-[10px] border border-destructive/40 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
              >
                Don&apos;t Save
              </button>
              <button
                onClick={() => setExitOpen(false)}
                className="rounded-[10px] px-4 py-2.5 text-sm text-text-muted hover:text-text-secondary"
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