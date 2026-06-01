'use client';

import Image from 'next/image';
import { Heart } from 'lucide-react';
import type { GameHeroData } from '@/types/gamePage';

interface GameHeaderProps extends GameHeroData {
  isPreload?: boolean;
}

/**
 * GameHeader Component - Hero Section
 * Displays game name, description, image, tags, and likes
 */
export function GameHeader({
  name,
  description,
  image,
  tags,
  likes,
  isPreload,
}: GameHeaderProps) {
  return (
    <header className="relative w-full overflow-hidden bg-gradient-to-b from-primary/10 to-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Image Section */}
          <div className="relative aspect-square overflow-hidden rounded-lg">
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
              priority
              quality={85}
            />
            {isPreload && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <p className="text-xs font-semibold text-white">From Card Cache</p>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-bold md:text-5xl">{name}</h1>

            {/* Likes */}
            <div className="mt-4 flex items-center gap-2">
              <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              <span className="font-semibold">{likes.toLocaleString()} likes</span>
            </div>

            {/* Description */}
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              {description}
            </p>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4">
              <button className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90">
                <Heart className="h-5 w-5" />
                Like This Game
              </button>
              <button className="rounded-lg border border-input bg-background px-6 py-3 font-semibold hover:bg-muted">
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
