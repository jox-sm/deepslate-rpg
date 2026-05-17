'use client';
import { useState, useCallback } from 'react';
import CardsGrid from '@/components/adventures/cards/cards-grid';
import { fetchGamesFromApi } from '@/utilities/utils';

export default function Page() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="mod2">
      <CardsGrid
        key={refreshKey}
        fetchCards={fetchGamesFromApi}
        batchSize={6}
        onRefresh={handleRefresh}
      />
    </div>
  );
}