import { v7 as uuidV7 } from 'uuid';
import { CardProps, GameCardProps } from '@/types/cards';
import { ApiResponse } from '@/types/cards';
import { tryOrError } from '@/utilities/errorHandler';
import { retry } from '@/lib/retry';
export function prepareGameCard(props: CardProps): GameCardProps {
  const uuid = uuidV7();
  
  const currentTime = new Date().toISOString(); 

  return {
    ...props,
    id: uuid,
    created_at: currentTime,
    updated_at: currentTime,
  };
}

export function prepareGameCards(cards: CardProps[]): GameCardProps[] {
  return cards.map(prepareGameCard);
}

export async function fetchGamesFromApi(offset: number): Promise<CardProps[]> {
  const limit = 6;
  const page = Math.floor(offset / limit) + 1;

  const result = await tryOrError(async () => {
    const res = await retry(() => fetch(`/api/games?page=${page}&limit=${limit}`), 3, 500);

    if (!res.ok) {
      throw new Error('Failed to fetch games');
    }

    const json: ApiResponse = await res.json();

    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map((game) => ({
      id: game.id,
      name: game.name || 'Untitled',
      description: game.description || '',
      likes_count: game.likes_count ?? 0,
      tags: game.tags || [],
      image: game.image || '/images/project.jpg',
    }));
  }, { context: "utils.fetchGamesFromApi" });

  if (!result.ok || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch games');
  }

  return result.data;
}