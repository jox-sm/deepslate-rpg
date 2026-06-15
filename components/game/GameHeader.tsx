'use client';

import { FittedImage } from '@/components/shared/FittedImage';
import LikeButton from '@/components/adventures/cards/like-button';
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
  id,
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
            <div className="mt-4">
              <LikeButton gameId={id} initialLikes={likes} />
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
