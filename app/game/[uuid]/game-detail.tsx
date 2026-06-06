'use client';

import { useEffect, useState } from 'react';
import { useGameCache, useGamePreload } from '@/utilities/clientUtilities/useGameCache';
import { CharacterTabs } from '@/components/game/CharacterTabs';
import { MapList } from '@/components/game/MapList';
import { ItemGrid } from '@/components/game/ItemGrid';
import { GameHeader } from '@/components/game/GameHeader';

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
  const [hasPreload, setHasPreload] = useState(false);
  const [activeTab, setActiveTab] = useState<'characters' | 'maps' | 'items'>('characters');
  const preloadedData = useGamePreload(uuid);
  const { data, loading, error, cacheStats, refreshData } = useGameCache(uuid);

  useEffect(() => {
    if (preloadedData) {
      setHasPreload(true);
    }
  }, [preloadedData]);

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
        name={displayData.name}
        description={displayData.description}
        image={displayData.image || '/images/default-game.png'}
        tags={displayData.tags || []}
        likes={displayData.likes_count || 0}
        isPreload={hasPreload && !data}
      />

      <div className="container-page py-8">
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
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent shadow-glow-accent-sm" />
              <p className="text-sm text-text-muted">Loading game data...</p>
            </div>
          </div>
        )}

        {error && !data && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-radial-accent opacity-20 pointer-events-none" />
            <h3 className="font-semibold text-destructive relative">Error Loading Game</h3>
            <p className="mt-1 text-sm text-text-muted relative">{error.message}</p>
            <button
              onClick={refreshData}
              className="mt-3 rounded-lg bg-destructive/20 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/30 relative"
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
