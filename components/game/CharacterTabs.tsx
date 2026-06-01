'use client';

import Image from 'next/image';
import type { CharacterDataJSON } from '@/types/gamedata';

interface CharacterTabsProps {
  characters: CharacterDataJSON[];
}

/**
 * CharacterTabs Component - Displays game characters
 */
export function CharacterTabs({ characters }: CharacterTabsProps) {
  if (!characters || characters.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No characters found for this game.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {characters.map((character) => (
        <div
          key={character.id}
          className="group overflow-hidden rounded-lg border border-input bg-card hover:border-primary hover:shadow-lg transition"
        >
          {/* Character Image */}
          <div className="relative aspect-square overflow-hidden bg-muted">
            <Image
              src={character.image || character.imagePreview}
              alt={character.name}
              fill
              className="object-cover group-hover:scale-105 transition"
            />
          </div>

          {/* Character Info */}
          <div className="p-4">
            <h3 className="font-semibold text-lg line-clamp-1">{character.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
              {character.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
