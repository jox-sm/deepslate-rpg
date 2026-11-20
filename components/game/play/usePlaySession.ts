"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadMemory,
  persistScenarioTurn,
  readTurn,
  shouldAutosave,
  writeTurn,
} from "@/lib/scenarios";
import * as play from "@/lib/playClient";
import { takeGameSeed, type GameSeed } from "@/lib/gameSeed";
import { classifyError } from "@/utilities/errorHandler";
import { errorToast } from "@/ui/notifications";
import { POLL_INTERVAL_MS, POLL_MAX_TRIES, TS_SKEW_SECONDS } from "./constants";
import type { Message } from "./types";

// Core play-session state and effects: memory restore, polling, autosave, send.
// UI/save concerns live in useSaveControls and the presentational subcomponents.
export function usePlaySession(sid: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState(true);

  const turnRef = useRef(readTurn(sid));
  // Output-consumption markers are mount-local — no localStorage persistence.
  // "Is this output new?" is decided against this session's send epoch
  // (sendEpochRef): anything stamped before it is a leftover still sitting in
  // output:{sid}.
  const lastConsumedRef = useRef<string | null>(null);
  const lastSeenTsRef = useRef<number | null>(null);
  const sendEpochRef = useRef<number>(0);
  // Catalog-game seed (if started from a game page); consumed on turn 1 only.
  const seedRef = useRef<GameSeed | null>(takeGameSeed(sid));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    // Stamp this send's epoch in seconds (engine time.time()) so the poll can
    // reject stale leftovers.
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

  return {
    messages,
    input,
    setInput,
    busy,
    error,
    setError,
    sealed,
    turn,
    turnRef,
    send,
  };
}
