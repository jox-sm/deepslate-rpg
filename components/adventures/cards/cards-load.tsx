'use client';

import { useEffect, useState } from 'react';
import style from '@/styles/cards/CardsLoad.module.css';
import ProfileCard from '@/components/adventures/cards/cards';
import { CardProps } from '@/types/cards';

type CardsLoadProps = {
  /** Starting index for this batch in the overall feed */
  offset: number;
  /** How many cards to request */
  batchSize: number;
  /** Async fetch function provided by CardsGrid */
  fetchCards: (offset: number) => Promise<CardProps[]>;
  /** Fired once the batch has been fetched and rendered */
  onBatchReady: () => void;
  /** Fired when the returned batch is smaller than batchSize (end of data) */
  onExhausted: () => void;
};

export default function CardsLoad({
  offset,
  batchSize,
  fetchCards,
  onBatchReady,
  onExhausted,
}: CardsLoadProps) {
  const [cards, setCards] = useState<CardProps[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchCards(offset);
        if (cancelled) return;

        setCards(result);

        if (result.length < batchSize) {
          onExhausted();
        } else {
          onBatchReady();
        }
      } catch (err) {
        if (cancelled) return;
        setError('Failed to load cards. Please try again.');
        onBatchReady(); // unblock the loading state
        console.error('[CardsLoad] fetchCards error:', err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  // offset is stable per instance; deps are intentionally narrow
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className={style.error}>{error}</p>;
  }

  if (cards.length === 0) {
    // Skeleton placeholders while fetching
    return (
      <div className={style.row}>
        {Array.from({ length: batchSize }).map((_, i) => (
          <div key={i} className={style.skeleton} aria-hidden="true" />
        ))}
      </div>
    );
  }

  // Chunk the flat cards array into rows of 3
  const rows: CardProps[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    rows.push(cards.slice(i, i + 3));
  }

  return (
    <div className={style.batch}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={style.row}>
          {row.map((card, colIndex) => (
            <div key={colIndex} className={style.cell}>
              <ProfileCard
              likes_count={card.likes_count}
                image={card.image}
                name={card.name}
                description={card.description}
                tags={card.tags}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}