'use client';

import { FittedImage } from '@/components/shared/FittedImage';
import LikeButton from '@/components/adventures/cards/like-button';
import { Button } from '@/ui/primitives/button';
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
    <header className="w-full border-b border-border">
      <div className="container-page py-10">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="dungeon-card relative overflow-hidden">
            <FittedImage
              src={image}
              alt={name}
              aspectRatio="1/1"
              priority
              quality={85}
            />
            {isPreload && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-base/80">
                <p className="text-xs font-medium text-text-muted">From card cache</p>
              </div>
            )}
          </div>
          <div className="flex max-w-xl flex-col justify-center">
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">{name}</h1>
            <div className="mt-4">
              <LikeButton gameId={id} initialLikes={likes} />
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
              {description}
            </p>
            {tags && tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-bg-surface px-2.5 py-1 text-xs text-text-secondary"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-7">
              <Button variant="outline">
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
