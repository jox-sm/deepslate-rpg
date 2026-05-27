'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ProfileCard from '@/components/adventures/cards/cards';
import style from '@/styles/cards/CardsGrid.module.css';
import rowStyle from '@/styles/cards/CardsLoad.module.css';
import { CardProps } from '@/types/cards';

type CardsGridProps = {
  fetchCards: (offset: number) => Promise<CardProps[]>;
  batchSize?: number;
};

export default function CardsGrid({
  fetchCards,
  batchSize = 6,
  onRefresh,
}: CardsGridProps) {
  const [cards, setCards] = useState<CardProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);
  const isExhaustedRef = useRef(false);

   const loadMore = useCallback(async () => {
     if (isLoadingRef.current || isExhaustedRef.current) return;
     isLoadingRef.current = true;
     setIsLoading(true);
     setError(null);

     try {
       const result = await fetchCards(offsetRef.current);
       if (result.length < batchSize) {
         isExhaustedRef.current = true;
         setIsExhausted(true);
       }
       setCards((prev) => [...prev, ...result]);
       offsetRef.current += result.length;
     } catch (err) {
       setError('Failed to load cards. Please try again.');
       console.error('[CardsGrid] fetch error:', err);
     } finally {
       isLoadingRef.current = false;
       setIsLoading(false);
     }
   }, [batchSize]);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    loadMoreRef.current();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: CardProps[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    rows.push(cards.slice(i, i + 3));
  }

  return (
    <div className={style.grid}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={rowStyle.row}>
          {row.map((card, colIndex) => (
            <div key={`${rowIndex}-${colIndex}`} className={rowStyle.cell}>
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

      {isLoading && (
        <div className={style.loader} aria-label="Loading more cards">
          <span className={style.loaderDot} />
          <span className={style.loaderDot} />
          <span className={style.loaderDot} />
        </div>
      )}

      {error && <p className={rowStyle.error}>{error}</p>}

      {isExhausted && (
        <p className={style.exhausted}>You&apos;ve reached the end.</p>
      )}
    </div>
  );
}
