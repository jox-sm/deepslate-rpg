'use client';

import Image from 'next/image';
import type { ItemDataJSON } from '@/types/gamedata';

interface ItemGridProps {
  items: ItemDataJSON[];
}

/**
 * ItemGrid Component - Displays game items
 */
export function ItemGrid({ items }: ItemGridProps) {
  if (!items || items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No items found for this game.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.id}
          className="group overflow-hidden rounded-lg border border-input bg-card hover:border-primary hover:shadow-lg transition cursor-pointer"
        >
          {/* Item Image */}
          <div className="relative aspect-square overflow-hidden bg-muted">
            <Image
              src={item.image || item.imagePreview}
              alt={item.name}
              fill
              className="object-cover group-hover:scale-105 transition"
            />
          </div>

          {/* Item Name */}
          <div className="p-3">
            <h4 className="text-sm font-semibold line-clamp-2">{item.name}</h4>
          </div>
        </div>
      ))}
    </div>
  );
}
