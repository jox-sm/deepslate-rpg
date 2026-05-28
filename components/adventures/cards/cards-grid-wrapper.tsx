'use client';
import CardsGrid from '@/components/adventures/cards/cards-grid';
import { fetchGamesFromApi } from '@/utilities/utils';

export default function CardsGridWrapper() {
  return <CardsGrid fetchCards={fetchGamesFromApi} batchSize={6} />;
}
