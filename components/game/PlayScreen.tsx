"use client";

import type { ScenarioMeta } from "@/lib/scenarios";
import { usePlaySession } from "./play/usePlaySession";
import { useSaveControls } from "./play/useSaveControls";
import { PlayHeader } from "./play/PlayHeader";
import { StoryPanel } from "./play/StoryPanel";
import { MoveInput } from "./play/MoveInput";
import { ExitModal } from "./play/ExitModal";

interface PlayScreenProps {
  sid: string;
  scenario: ScenarioMeta;
}

/**
 * Thin orchestrator for a single play session. All game state/effects live in
 * usePlaySession, save/exit behavior in useSaveControls, and rendering is split
 * across the presentational components under ./play.
 */
export default function PlayScreen({ sid, scenario }: PlayScreenProps) {
  const { messages, input, setInput, busy, error, setError, sealed, turn, turnRef, send } =
    usePlaySession(sid);
  const { savingFile, exitOpen, setExitOpen, saveFile, saveAndExit, discard } = useSaveControls({
    sid,
    busy,
    sealed,
    turnRef,
    setError,
  });

  return (
    <div className="mx-auto flex h-screen w-full max-w-2xl flex-col px-4">
      <PlayHeader
        name={scenario.name}
        turn={turn}
        savingFile={savingFile}
        onSaveFile={() => void saveFile()}
        onExit={() => setExitOpen(true)}
      />

      <StoryPanel
        messages={messages}
        busy={busy}
        error={error}
        onDismissError={() => setError(null)}
      />

      <MoveInput
        input={input}
        onInputChange={setInput}
        busy={busy}
        sealed={sealed}
        onSubmit={() => void send(input)}
      />

      {exitOpen && (
        <ExitModal
          onSave={() => void saveAndExit()}
          onDiscard={() => void discard()}
          onClose={() => setExitOpen(false)}
        />
      )}
    </div>
  );
}
