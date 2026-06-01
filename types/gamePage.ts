import type {
  CharacterDataJSON,
  MapDataJSON,
  ItemDataJSON,
} from './gamedata';

/**
 * Full game data returned from GamePage API
 * Includes flat fields (from card) + nested data (characters, maps, items)
 */
export interface FullGamePageData {
  // Flat fields (from card)
  id: string;
  name: string;
  description: string;
  image?: string;
  tags?: string[];
  likes_count?: number;
  created_at?: string;
  updated_at?: string;

  // Nested data (from MongoDB)
  characters: CharacterDataJSON[];
  maps: MapDataJSON[];
  items: ItemDataJSON[];
  status: string;
}

/**
 * Preloaded card data (from profileCard click)
 * Minimal set for instant hero section render
 */
export interface GameCardPreloadData {
  id: string;
  name: string;
  description: string;
  image: string;
  tags: string[];
  likes_count: number;
}

/**
 * Game page component props
 */
export interface GamePageProps {
  params: {
    uuid: string;
  };
}

/**
 * Cache statistics for debugging/monitoring
 */
export interface GameCacheStats {
  entriesCount: number;
  maxEntries: number;
  memoryPressure: boolean;
  queueLength: number;
}

/**
 * Hero section data structure
 */
export interface GameHeroData {
  name: string;
  description: string;
  image: string;
  tags: string[];
  likes: number;
}

/**
 * Character tab data
 */
export interface CharacterTabData {
  characters: CharacterDataJSON[];
  isLoading: boolean;
}

/**
 * Map list data
 */
export interface MapListData {
  maps: MapDataJSON[];
  isLoading: boolean;
}

/**
 * Item grid data
 */
export interface ItemGridData {
  items: ItemDataJSON[];
  isLoading: boolean;
}
