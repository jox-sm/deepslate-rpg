'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ProfileCard from '@/components/adventures/cards/cards';
import { CardProps } from '@/types/cards';
import { RevealItem } from '@/ui/primitives/motion';
import { Button } from '@/ui/primitives/button';
import { tryOrErrorSync, classifyError } from '@/utilities/errorHandler';

type CardsGridProps = {
  fetchCards: (offset: number) => Promise<CardProps[]>;
  batchSize?: number;
};

const CACHE_KEY = "cards-grid-cache";

function saveCache(cards: CardProps[], offset: number, exhausted: boolean) {
  tryOrErrorSync(() => {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cards, offset, exhausted }));
  }, { context: "CardsGrid.saveCache" });
}

function loadCache(): { cards: CardProps[]; offset: number; exhausted: boolean } | null {
  const result = tryOrErrorSync(() => {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }, { context: "CardsGrid.loadCache" });
  return result.ok ? result.data : null;
}

function CardSkeleton() {
  return (
    <div className="dungeon-card overflow-hidden" aria-hidden>
      <div className="aspect-[16/10] animate-pulse bg-bg-surface" />
      <div className="space-y-2 p-4">
        <div className="h-5 w-2/3 animate-pulse rounded bg-bg-surface" />
        <div className="h-4 w-full animate-pulse rounded bg-bg-surface" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-bg-surface" />
      </div>
    </div>
  );
}

export default function CardsGrid({
  fetchCards,
  batchSize = 6,
}: CardsGridProps) {
  const [cached] = useState(loadCache);
  const [cards, setCards] = useState<CardProps[]>(cached?.cards ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [isExhausted, setIsExhausted] = useState(cached?.exhausted ?? false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(cached?.offset ?? 0);
  const isLoadingRef = useRef(false);
  const isExhaustedRef = useRef(cached?.exhausted ?? false);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || isExhaustedRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchCards(offsetRef.current);
      const exhausted = result.length < batchSize;
      if (exhausted) {
        isExhaustedRef.current = true;
        setIsExhausted(true);
      }
      setCards((prev) => {
        const next = [...prev, ...result];
        saveCache(next, offsetRef.current + result.length, exhausted);
        return next;
      });
      offsetRef.current += result.length;
    } catch (err) {
      setError('The codex could not be reached. Check your path and try again.');
      const classified = classifyError(err, "CardsGrid.fetch");
      console.error('[CardsGrid] fetch error:', classified.message);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [fetchCards, batchSize]);

  const loadMoreRef = useRef(loadMore);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Fetch-on-mount when there is no session cache.
  useEffect(() => {
    if (!cached) {
      loadMoreRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (scrolled >= total - 300) {
        loadMoreRef.current();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isLoading && cards.length === 0 && error) {
    return (
      <div className="dungeon-card mx-auto max-w-lg p-8 text-center">
        <h3 className="font-display text-xl font-semibold">No path found</h3>
        <p className="mx-auto mt-2 text-sm text-text-muted">{error}</p>
        <Button className="mt-5" onClick={() => loadMoreRef.current()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!isLoading && cards.length === 0 && !error) {
    return (
      <div className="dungeon-card mx-auto max-w-lg p-8 text-center">
        <h3 className="font-display text-xl font-semibold">The codex is empty</h3>
        <p className="mx-auto mt-2 text-sm text-text-muted">
          No delves yet. Forge the first world and it will appear here.
        </p>
        <Button className="mt-5" asChild>
          <a href="/inventory">Forge a world</a>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <RevealItem key={`${card.id}-${i}`}>
            <ProfileCard
              id={card.id}
              likes_count={card.likes_count}
              image={card.image}
              name={card.name}
              description={card.description}
              tags={card.tags}
            />
          </RevealItem>
        ))}
        {isLoading &&
          [0, 1, 2].map((i) => <CardSkeleton key={`skeleton-${i}`} />)}
      </div>

      {error && cards.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <p className="text-sm text-text-muted">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadMoreRef.current()}>
            Retry
          </Button>
        </div>
      )}

      {isExhausted && cards.length > 0 && (
        <p className="mt-8 text-center text-sm text-text-muted">
          You have mapped every known delve.
        </p>
      )}
    </div>
  );
}
