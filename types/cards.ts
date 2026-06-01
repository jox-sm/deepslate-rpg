type CardProps = {
  name: string;
  description: string;
  likes_count: number;
  tags: string[];
  image: string;
};
export type { CardProps };

type GameCardProps = CardProps & {
  id: string; // UUID 7
  created_at: string;
  updated_at: string;
};
export type { GameCardProps };



type CardGrid = {
  numOfCards: number;
  cards: CardProps[];
};
export type {CardGrid};

export interface ApiGameResponse {
  id: string;
  name: string;
  description: string;
  image?: string;
  tags?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  likes_count?: number;
}

export interface ApiResponse {
  success: boolean;
  data: ApiGameResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    source: string;
  };
}