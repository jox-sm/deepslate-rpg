import PlayGate from "@/components/game/PlayGate";

export default async function PlayGamePage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  return <PlayGate sid={sid} />;
}