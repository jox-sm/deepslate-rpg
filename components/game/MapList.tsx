'use client';

import Image from 'next/image';
import type { MapDataJSON } from '@/types/gamedata';

interface MapListProps {
  maps: MapDataJSON[];
}

/**
 * MapList Component - Displays game maps
 */
export function MapList({ maps }: MapListProps) {
  if (!maps || maps.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No maps found for this game.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {maps.map((map) => (
        <div
          key={map.id}
          className="overflow-hidden rounded-lg border border-input bg-card hover:border-primary hover:shadow-lg transition"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Map Image */}
            <div className="relative aspect-video overflow-hidden bg-muted md:col-span-2 lg:col-span-2">
              <Image
                src={map.image || map.imagePreview}
                alt={map.nameOfPlace}
                fill
                className="object-cover"
              />
            </div>

            {/* Map Info */}
            <div className="flex flex-col justify-between p-4">
              <div>
                <h3 className="font-semibold text-lg">{map.nameOfPlace}</h3>

                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <span className="font-semibold text-muted-foreground">Size:</span>
                    <p className="mt-1 text-foreground">{map.sizeOfPlace}</p>
                  </div>

                  <div>
                    <span className="font-semibold text-muted-foreground">Locations:</span>
                    <p className="mt-1 text-foreground line-clamp-3">{map.placesAtMap}</p>
                  </div>
                </div>
              </div>

              <button className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 w-full">
                Explore Map
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
