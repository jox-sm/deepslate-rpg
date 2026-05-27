import { v7 as uuidV7 } from 'uuid';
import { CardProps, GameCardProps } from '@/types/cards';
import {ApiGameResponse , ApiResponse} from '@/types/cards';
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

  const res = await fetch(`/api/games?page=${page}&limit=${limit}`);

  if (!res.ok) {
    throw new Error('Failed to fetch games');
  }

  const json: ApiResponse = await res.json();

  if (!json.success || !json.data) {
    return [];
  }

return json.data.map((game) => ({
  name: game.name || 'Untitled',
  description: game.description || '',
  likes_count: game.likes_count ?? 0,
  tags: game.tags || [],
  image: game.image || '/images/project.jpg',
}));
}