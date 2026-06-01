'use client';

import { useEffect, useState } from 'react';
import { useGameCache, useGamePreload } from '@/utilities/clientUtilities/useGameCache';
import { CharacterTabs } from '@/components/game/CharacterTabs';
import { MapList } from '@/components/game/MapList';
import { ItemGrid } from '@/components/game/ItemGrid';
import { GameHeader } from '@/components/game/GameHeader';
import type { FullGamePageData } from '@/types/gamePage';

interface GameDetailClientProps {
  uuid: string;
  initialName?: string;
  initialDescription?: string;
  initialImage?: string;
}

/**
 * GamePage Client Component
 *
 * Handles:
 * - Data fetching via useGameCache hook
 * - Preloaded data from sessionStorage
 * - Instant hero section render
 * - Tab/grid rendering for nested data
 * - Error states and loading
 */

export default function GameDetailClient({
  uuid,
  initialName,
  initialDescription,
  initialImage,
}: GameDetailClientProps) {
  const [hasPreload, setHasPreload] = useState(false);
  const [activeTab, setActiveTab] = useState<'characters' | 'maps' | 'items'>('characters');

  // Get preloaded data from sessionStorage (passed from ProfileCard)
  const preloadedData = useGamePreload(uuid);

  // Fetch full game data with cache
  const { data, loading, error, cacheStats, refreshData } =
    useGameCache(uuid);

  useEffect(() => {
    if (preloadedData) {
      setHasPreload(true);
    }
  }, [preloadedData]);

  const displayData = data || {
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
  };

  return (
    <div className="w-full">
      {/* Hero Section - Instant Render with Preload */}
      <GameHeader
        name={displayData.name}
        description={displayData.description}
        image={displayData.image}
        tags={displayData.tags || []}
        likes={displayData.likes_count || 0}
        isPreload={hasPreload && !data}
      />

      {/* Content Section - Tabs for Nested Data */}
      <div className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="mb-6 flex gap-4 border-b">
          {[
            { id: 'characters', label: 'Characters', count: displayData.characters?.length || 0 },
            { id: 'maps', label: 'Maps', count: displayData.maps?.length || 0 },
            { id: 'items', label: 'Items', count: displayData.items?.length || 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'characters' | 'maps' | 'items')}
              className={`px-4 py-2 font-semibold transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              disabled={loading && !data}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && !data && (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading game data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !data && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <h3 className="font-semibold text-destructive">Error Loading Game</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
            <button
              onClick={refreshData}
              className="mt-4 rounded px-3 py-1 text-sm font-medium hover:bg-destructive/20"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content Tabs */}
        {data && !loading && (
          <div>
            {activeTab === 'characters' && (
              <CharacterTabs characters={displayData.characters} />
            )}
            {activeTab === 'maps' && (
              <MapList maps={displayData.maps} />
            )}
            {activeTab === 'items' && (
              <ItemGrid items={displayData.items} />
            )}
          </div>
        )}

        {/* Empty State */}
        {data && !loading && activeTab === 'characters' && displayData.characters.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No characters found for this game.</p>
          </div>
        )}
        {data && !loading && activeTab === 'maps' && displayData.maps.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No maps found for this game.</p>
          </div>
        )}
        {data && !loading && activeTab === 'items' && displayData.items.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No items found for this game.</p>
          </div>
        )}
      </div>

      {/* Cache Stats (Development Only) */}
      {process.env.NODE_ENV === 'development' && cacheStats && (
        <div className="border-t bg-muted/50 p-4">
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold">Cache Stats</summary>
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
