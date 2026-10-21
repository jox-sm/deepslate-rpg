'use client';

import { FittedImage } from '@/components/shared/FittedImage';
import type { MapDataJSON } from '@/types/gamedata';

interface MapListProps {
  maps: MapDataJSON[];
}

export function MapList({ maps }: MapListProps) {
  if (!maps || maps.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-text-muted">No maps found for this game.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {maps.map((map) => (
        <div
          key={map.id}
          className="dungeon-card overflow-hidden transition-colors"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FittedImage
              src={map.image || map.imagePreview}
              alt={map.nameOfPlace}
              aspectRatio="16/9"
              containerClassName="overflow-hidden bg-bg-elevated md:col-span-2 lg:col-span-2"
            />
            <div className="flex flex-col justify-between p-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-text-primary">{map.nameOfPlace}</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Size</span>
                    <p className="mt-0.5 text-text-secondary">{map.sizeOfPlace}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Locations</span>
                    <p className="mt-0.5 text-text-secondary line-clamp-3">{map.placesAtMap}</p>
                  </div>
                </div>
              </div>
              <button className="mt-4 w-full rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-charcoal-950 transition-colors hover:bg-accent-hover">
                Explore Map
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
