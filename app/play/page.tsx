"use client";

import { useRouter } from "next/navigation";
import ScenarioEntry from "@/components/game/ScenarioEntry";
import type { ScenarioMeta } from "@/lib/scenarios";

export default function PlayPage() {
  const router = useRouter();

  function onEnter(scenario: ScenarioMeta, _restore: boolean) {
    router.push(`/play/${scenario.id}`);
  }

  return <ScenarioEntry onEnter={onEnter} />;
}