"use client";

import Link from "next/link";
import { getScenario } from "@/lib/scenarios";
import PlayScreen from "@/components/game/PlayScreen";

export default function PlayGate({ sid }: { sid: string }) {
  const scenario = getScenario(sid);

  if (!scenario) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-text-secondary">Adventure not found</p>
        <p className="mt-1 text-sm text-text-muted">
          This save slot doesn&apos;t exist in this browser.
        </p>
        <Link href="/play" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to adventures
        </Link>
      </div>
    );
  }

  return <PlayScreen sid={sid} scenario={scenario} />;
}