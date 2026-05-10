'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import style from '@/styles/cards/CardsGrid.module.css';
import CardsLoad from '@/components/adventures/cards/cards-load';
import { CardProps } from '@/types/cards';

type CardsGridProps = {
  /**
   * Async function that receives the current offset and returns
   * the next batch of cards (6 per page).
   * You configure the actual DB/API call — just match this signature.
   */
  fetchCards: (offset: number) => Promise<CardProps[]>;
  /** How many cards to load per batch. Defaults to 6. */
  batchSize?: number;
};

type Batch = {
  id: number;
  offset: number;
};

export default function CardsGrid({
  fetchCards,
  batchSize = 6,
}: CardsGridProps) {
  const [batches, setBatches] = useState<Batch[]>([{ id: 0, offset: 0 }]);
  const [isExhausted, setIsExhausted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const nextOffset = useRef<number>(batchSize);
  const batchCounter = useRef<number>(1);

  const loadMore = useCallback(() => {
    if (isLoading || isExhausted) return;

    setIsLoading(true);
    const offset = nextOffset.current;

    setBatches((prev) => [
      ...prev,
      { id: batchCounter.current, offset },
    ]);

    nextOffset.current += batchSize;
    batchCounter.current += 1;
  }, [isLoading, isExhausted, batchSize]);

  /** Called by CardsLoad when a fetch returns fewer than batchSize cards */
  const handleExhausted = useCallback(() => {
    setIsExhausted(true);
    setIsLoading(false);
  }, []);

  /** Called by CardsLoad once it finishes rendering its batch */
  const handleBatchReady = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;

      // Trigger when within 300px of the bottom
      if (scrolled >= total - 300) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  return (
    <div className={style.grid}>
      {batches.map((batch) => (
        <CardsLoad
          key={batch.id}
          offset={batch.offset}
          batchSize={batchSize}
          fetchCards={fetchCards}
          onBatchReady={handleBatchReady}
          onExhausted={handleExhausted}
        />
      ))}

      {isLoading && (
        <div className={style.loader} aria-label="Loading more cards">
          <span className={style.loaderDot} />
          <span className={style.loaderDot} />
          <span className={style.loaderDot} />
        </div>
      )}

      {isExhausted && (
        <p className={style.exhausted}>You&apos;ve reached the end.</p>
      )}
    </div>
  );
}