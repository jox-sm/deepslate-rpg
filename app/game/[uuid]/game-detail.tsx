'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v7 as uuidv7 } from 'uuid';
import { useGameCache, useGamePreload } from '@/utilities/clientUtilities/useGameCache';
import { CharacterTabs } from '@/components/game/CharacterTabs';
import { MapList } from '@/components/game/MapList';
import { ItemGrid } from '@/components/game/ItemGrid';
import { GameHeader } from '@/components/game/GameHeader';
import { createScenarioWithId } from '@/lib/scenarios';
import { saveGameSeed, type GameSeed } from '@/lib/gameSeed';
import { classifyError } from '@/utilities/errorHandler';
interface GameDetailClientProps {
  uuid: string;
  initialName?: string;
  initialDescription?: string;
  initialImage?: string;
}

export default function GameDetailClient({
  uuid,
  initialName,
  initialDescription,
  initialImage,
}: GameDetailClientProps) {
  const router = useRouter();
  const preloadedData = useGamePreload(uuid);
  const hasPreload = preloadedData != null;
  const [activeTab, setActiveTab] = useState<'characters' | 'maps' | 'items'>('characters');
  const { data, loading, error, cacheStats, refreshData } = useGameCache(uuid);
  const [startingRun, setStartingRun] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  // Starts a play session seeded from this catalog game: registers a scenario
  // slot whose id is the fresh session id, stashes the creative payload
  // (characters/maps/items) for PlayScreen to inject into the first AI request,
  // and navigates to /play/{sid}.
  async function startPlaySession() {
    if (startingRun) return;
    setStartingRun(true);
    setPlayError(null);
    try {
      const sid = uuidv7();
      const scenario = createScenarioWithId(sid, displayData.name || 'Unnamed Adventure');
      if (!scenario) throw new Error('Scenario slots are full — free one up from /play first');
      const seed: GameSeed = {
        game_id: displayData.id,
        name: displayData.name,
        description: displayData.description || '',
        // Slim the payload: names/descriptions only — image blobs stay out of
        // the queue item.
        characters: (displayData.characters ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
        })),
        maps: (displayData.maps ?? []).map((m) => ({
          id: m.id,
          name: m.nameOfPlace,
          places_at: m.placesAtMap,
          size: m.sizeOfPlace,
        })),
        items: (displayData.items ?? []).map((i) => ({ id: i.id, name: i.name })),
      };
      if (!saveGameSeed(sid, seed)) throw new Error('Could not stash the game seed for this session');
      router.push(`/play/${sid}`);
    } catch (e) {
      const classified = classifyError(e, 'gameDetail.startPlaySession');
      setStartingRun(false);
      setPlayError(classified.message);
    }
  }

  const displayData = {
    id: uuid,
    name: preloadedData?.name || initialName || 'Loading...',
    description: preloadedData?.description || initialDescription || '',
    image: preloadedData?.image || initialImage || '/images/default-game.png',
    tags: preloadedData?.tags || [],
    likes_count: preloadedData?.likes_count || 0,
    characters: [],
    maps: [],
    items: [],
    status: 'draft',
    ...data,
  };

  const tabs = [
    { id: 'characters' as const, label: 'Characters', count: displayData.characters?.length || 0 },
    { id: 'maps' as const, label: 'Maps', count: displayData.maps?.length || 0 },
    { id: 'items' as const, label: 'Items', count: displayData.items?.length || 0 },
  ];

  return (
    <div className="w-full">
      <GameHeader
        id={displayData.id}
        name={displayData.name}
        description={displayData.description}
        image={displayData.image || '/images/default-game.png'}
        tags={displayData.tags || []}
        likes={displayData.likes_count || 0}
        isPreload={hasPreload && !data}
      />

      <div className="container-page py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            Enter the game&apos;s world as an AI-driven adventure.
          </p>
          <button
            onClick={startPlaySession}
            disabled={startingRun || loading && !data}
            className="rounded-[10px] bg-accent px-5 py-2.5 text-sm font-semibold text-charcoal-950 transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {startingRun ? 'Opening the depths…' : 'Play'}
          </button>
        </div>
        {playError && (
          <p className="mb-6 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {playError}
          </p>
        )}

        <div className="mb-6 flex gap-6 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-1 py-3 text-sm font-medium transition-all duration-200 ease-ember border-b-2 ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:border-text-muted/30'
              }`}
              disabled={loading && !data}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {loading && !data && (
          <div className="flex justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent glow-accent-sm" />
              <p className="text-sm text-text-muted">Loading game data...</p>
            </div>
          </div>
        )}

        {error && !data && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-radial-accent opacity-20 pointer-events-none" />
            <h3 className="font-semibold text-destructive relative">Error Loading Game</h3>
            <p className="mt-1 text-sm text-text-muted relative">{error.message}</p>
            <button
              onClick={refreshData}
              className="mt-3 rounded-[10px] bg-destructive/20 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/30 relative"
            >
              Try Again
            </button>
          </div>
        )}

        {data && !loading && (
          <div>
            {activeTab === 'characters' && <CharacterTabs characters={displayData.characters} />}
            {activeTab === 'maps' && <MapList maps={displayData.maps} />}
            {activeTab === 'items' && <ItemGrid items={displayData.items} />}
          </div>
        )}

        {data && !loading && displayData[activeTab]?.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-text-muted">No {activeTab} found for this game.</p>
          </div>
        )}
      </div>

      {process.env.NODE_ENV === 'development' && cacheStats && (
        <div className="border-t border-border bg-bg-elevated/50 p-4">
          <details className="cursor-pointer text-xs text-text-muted">
            <summary className="font-medium">Cache Stats</summary>
            <div className="mt-2 space-y-1">
              <p>Cache: {cacheStats.entriesCount}/{cacheStats.maxEntries}</p>
              <p>Memory Pressure: {cacheStats.memoryPressure ? 'Yes' : 'No'}</p>
              <p>Queue Length: {cacheStats.queueLength}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
