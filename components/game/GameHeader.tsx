'use client';

import { Heart } from 'lucide-react';
import { FittedImage } from '@/components/shared/FittedImage';
import type { GameHeroData } from '@/types/gamePage';

interface GameHeaderProps extends GameHeroData {
  isPreload?: boolean;
}

export function GameHeader({
  name,
  description,
  image,
  tags,
  likes,
  isPreload,
}: GameHeaderProps) {
  return (
    <header className="relative w-full overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-transparent to-bg-base pointer-events-none" />
      <div className="container-page py-12 relative">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl shadow-lg shadow-accent/10">
            <FittedImage
              src={image}
              alt={name}
              aspectRatio="1/1"
              priority
              quality={85}
            />
            {isPreload && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-base/80 z-10">
                <p className="text-xs font-semibold text-white/80">From Card Cache</p>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="font-display text-4xl font-bold text-gradient md:text-5xl">{name}</h1>
            <div className="mt-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive" fill="currentColor" />
              <span className="text-sm font-medium text-text-secondary">{likes.toLocaleString()} likes</span>
            </div>
            <p className="mt-6 text-base leading-relaxed text-text-muted">
              {description}
            </p>
            {tags && tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-8 flex gap-4">
              <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-ember-500 to-accent px-6 py-3 text-sm font-semibold text-white shadow-lg glow-accent-sm transition-all duration-200 ease-ember hover:from-ember-400 hover:to-accent-hover active:scale-[0.97]">
                <Heart className="h-5 w-5" fill="currentColor" />
                Like This Game
              </button>
              <button className="rounded-lg border border-border bg-glass px-6 py-3 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent/30 hover:text-text-primary active:scale-[0.97]">
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
