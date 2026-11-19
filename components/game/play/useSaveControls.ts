"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearMemory, persistScenarioTurn } from "@/lib/scenarios";
import * as play from "@/lib/playClient";
import { buildSavesSnapshot, downloadSavesFile } from "@/lib/saveFile";
import { classifyError } from "@/utilities/errorHandler";
import { errorToast, successToast } from "@/ui/notifications";

interface SaveControlsArgs {
  sid: string;
  busy: boolean;
  sealed: boolean;
  // The live turn counter shared with the play session (mutated in place).
  turnRef: { current: number };
  setError: (error: string | null) => void;
}

/**
 * Save / exit controls: header "Save" (whole-vault download), "Save & Exit"
 * and "Don't Save". Depends on session state passed in by PlayScreen.
 */
export function useSaveControls({
  sid,
  busy,
  sealed,
  turnRef,
  setError,
}: SaveControlsArgs) {
  const router = useRouter();
  const [savingFile, setSavingFile] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  // The "Save" mechanic: refresh this session's memory from the AI server
  // (Redis/Upstash Search) into the vault, then download the whole vault —
  // every scenario, memory blob and turn counter — as a versioned JSON file.
  // Import it back from the scenario list to regain a run.
  async function saveFile() {
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

  async function saveAndExit() {
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

  async function discard() {
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

  return { savingFile, exitOpen, setExitOpen, saveFile, saveAndExit, discard };
}
