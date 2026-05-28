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

const CACHE_KEY = "cards-grid-cache";

function saveCache(cards: CardProps[], offset: number, exhausted: boolean) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cards, offset, exhausted }));
  } catch { /* storage full — ignore */ }
}

function loadCache(): { cards: CardProps[]; offset: number; exhausted: boolean } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export default function CardsGrid({
  fetchCards,
  batchSize = 6,
}: CardsGridProps) {
  const [cards, setCards] = useState<CardProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);
  const isExhaustedRef = useRef(false);
  const initialLoaded = useRef(false);

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
    if (initialLoaded.current) return;
    initialLoaded.current = true;
    const cached = loadCache();
    if (cached) {
      setCards(cached.cards);
      offsetRef.current = cached.offset;
      if (cached.exhausted) {
        isExhaustedRef.current = true;
        setIsExhausted(true);
      }
    } else {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={style.grid}>
      {cards.map((card, i) => (
        <div key={`${card.name}-${i}`} className={rowStyle.cardWrapper}>
          <ProfileCard
            likes_count={card.likes_count}
            image={card.image}
            name={card.name}
            description={card.description}
            tags={card.tags}
          />
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
