import { v7 as uuidV7 } from 'uuid';
import { CardProps, GameCardProps } from '@/types/cards';

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

