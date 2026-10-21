'use client';

import { FittedImage } from '@/components/shared/FittedImage';
import type { CharacterDataJSON } from '@/types/gamedata';

interface CharacterTabsProps {
  characters: CharacterDataJSON[];
}

export function CharacterTabs({ characters }: CharacterTabsProps) {
  if (!characters || characters.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-text-muted">No characters found for this game.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {characters.map((character) => (
        <div
          key={character.id}
          className="dungeon-card group overflow-hidden transition-colors"
        >
          <FittedImage
            src={character.image || character.imagePreview}
            alt={character.name}
            aspectRatio="1/1"
            className="transition-transform duration-300 group-hover:scale-105"
            containerClassName="overflow-hidden bg-bg-elevated"
          />
          <div className="p-4">
            <h3 className="font-display text-lg font-semibold text-text-primary line-clamp-1">{character.name}</h3>
            <p className="mt-2 text-sm text-text-muted line-clamp-3 leading-relaxed">
              {character.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
