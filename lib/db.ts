import { sql } from '@/db/client';
import { GameCardProps } from '@/types/cards';
import { retry } from './retry';


export async function insertGame(game: GameCardProps) {
  try {
    const result = await retry(async () => {
      const rows = await sql`
        INSERT INTO games (id, name, description, image, tags, created_at, updated_at)
        VALUES (${game.id}, ${game.name}, ${game.description}, ${game.image}, ${game.tags}, ${game.created_at}, ${game.updated_at})
        RETURNING id;
      `;
      return rows;
    }, 2, 500);
    return result[0];
  } catch (error) {
    console.error("Error in insertGame:", error);
    throw error;
  }
}

export async function insertGamesBatch(games: GameCardProps[]) {
  try{
  const tagsArray = games.map(g => `{${g.tags.join(',')}}`);

const result = await retry(async () => {
  const rows = await sql`
    INSERT INTO games (id, name, description, image, tags, created_at, updated_at)
    SELECT
      id::uuid, name, description, image,
      tags::text[],
      created_at::timestamptz, updated_at::timestamptz
    FROM UNNEST(
      ${games.map(g => g.id)}::uuid[],
      ${games.map(g => g.name)}::text[],
      ${games.map(g => g.description)}::text[],
      ${games.map(g => g.image)}::text[],
      ${tagsArray}::text[],
      ${games.map(g => g.created_at)}::timestamptz[],
      ${games.map(g => g.updated_at)}::timestamptz[]
    ) AS t(id, name, description, image, tags, created_at, updated_at)
    RETURNING id;
  `;
  return rows;
}, 2, 500);
  return result;
  }  catch (error: any) {
    console.error("insertGamesBatch failed:");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Detail:", error.detail);
    console.error("Hint:", error.hint);
    console.error("Position:", error.position);
    console.error("Data sent:", JSON.stringify(games, null, 2));
    throw error;
  }
}


export async function updateGameLikes(id: string) {
  try {
    const now = new Date().toISOString();
    const result = await retry(async () => {
      const rows = await sql`
        UPDATE games
        SET likes_count = likes_count + 1, updated_at = ${now}
        WHERE id = ${id}
        RETURNING id;
      `;
      return rows;
    }, 2, 500);
    return result[0];
  } catch (error) {
    console.error("Error in updateGameLikes:", error);
    throw error;
  }
}

export async function updateGamesLikesBatch(likesMap: Map<string, number>) {
  const ids = Array.from(likesMap.keys());
  const likesCounts = Array.from(likesMap.values());

  const result = await retry(async () => {
    const rows = await sql`
      UPDATE games
      SET
        likes_count = games.likes_count + updates.likes_delta,
        updated_at = NOW()
      FROM UNNEST(
        ${ids}::uuid[],
        ${likesCounts}::int[]
      ) AS updates(id, likes_delta)
      WHERE games.id = updates.id
      RETURNING id, likes_count;
    `;
    return rows;
  }, 2, 500);

  return result;
}


export async function getGames(minimumLikes: number, idx: number) {
  const games = await retry(async () => {
    const rows = await sql`
      SELECT * FROM games
      WHERE likes_count >= ${minimumLikes}
      ORDER BY likes_count DESC
      LIMIT 6 OFFSET ${idx};
    `;
    return rows as GameCardProps[];
  }, 3, 500);

  return {
    games,
    nextIdx: idx + 6
  };
}

export async function getGamesPaginated(limit: number, offset: number) {
  const games = await retry(async () => {
    const rows = await sql`
      SELECT * FROM games
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    return rows as GameCardProps[];
  }, 3, 500);

  const countResult = await retry(async () => {
    const rows = await sql`SELECT COUNT(*) as total FROM games`;
    return rows;
  }, 3, 500);
  const total = Number(countResult[0]?.total || 0);

  return { games, total };
}

export async function getGameById(id: string) {
  const games = await retry(async () => {
    const rows = await sql`
      SELECT * FROM games
      WHERE id = ${id}
      LIMIT 1;
    `;
    return rows as GameCardProps[];
  }, 3, 500);

  return games[0] || null;
}
