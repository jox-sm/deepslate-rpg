'use client';

import { FittedImage } from '@/components/shared/FittedImage';
import type { ItemDataJSON } from '@/types/gamedata';

interface ItemGridProps {
  items: ItemDataJSON[];
}

export function ItemGrid({ items }: ItemGridProps) {
  if (!items || items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-text-muted">No items found for this game.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.id}
          className="dungeon-card group overflow-hidden transition-colors"
        >
          <FittedImage
            src={item.image || item.imagePreview}
            alt={item.name}
            aspectRatio="1/1"
            className="transition-transform duration-300 group-hover:scale-105"
            containerClassName="overflow-hidden bg-bg-elevated"
          />
          <div className="p-3">
            <h4 className="text-sm font-medium text-text-primary line-clamp-2">{item.name}</h4>
          </div>
        </div>
      ))}
    </div>
  );
}
