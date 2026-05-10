import { sql } from '@/db/client';
import { GameCardProps } from '@/types/cards';


export async function insertGame(game: GameCardProps) {
  try {
    const result = await sql`
      INSERT INTO games (id, name, description, image, tags, created_at, updated_at)
      VALUES (${game.id}, ${game.name}, ${game.description}, ${game.image}, ${game.tags}, ${game.created_at}, ${game.updated_at})
      RETURNING id;
    `;
    return result[0];
  } catch (error) {
    console.error("❌ Error in insertGame:", error);
    throw error;
  }
}

export async function insertGamesBatch(games: GameCardProps[]) {
  try {
    const result = await sql`
      INSERT INTO games (id, name, description, image, tags, created_at, updated_at)
      SELECT * FROM UNNEST(
        ${games.map(g => g.id)}::uuid[], 
        ${games.map(g => g.name)}::text[], 
        ${games.map(g => g.description)}::text[], 
        ${games.map(g => g.image)}::text[], 
        ${games.map(g => g.tags)}::text[][], 
        ${games.map(g => g.created_at)}::timestamptz[], 
        ${games.map(g => g.updated_at)}::timestamptz[]
      )
      RETURNING id;
    `;
    return result;
  } catch (error) {
    console.error("❌ Error in insertGamesBatch:", error);
    throw error;
  }
}

export async function getGames() {
  try {
    const games = await sql`
      SELECT * FROM games ORDER BY likes_count DESC;
    ` as GameCardProps[];
    return games;
  } catch (error) {
    console.error("Error in gettingGames:", error);
    return [];
  }
}

export async function updateGameLikes(id: string) {
  try {
    const now = new Date().toISOString();
    const result = await sql`
      UPDATE games
      SET likes_count = likes_count + 1, updated_at = ${now}
      WHERE id = ${id}
      RETURNING id;
    `;
    return result[0];
  } catch (error) {
    console.error("Error in updateGameLikes:", error);
    throw error;
  }
}