'use client';
import CardsGrid from '@/components/adventures/cards/cards-grid';
import { fetchGamesFromApi } from '@/utilities/utils';
import style from '@/styles/pages/home.module.css';

export default function Page() {
  return (
    <div className={style.container}>
      <CardsGrid
        fetchCards={fetchGamesFromApi}
        batchSize={6}
      />
    </div>
  );
}