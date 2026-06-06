import { drain } from "@/utilities/queue";
import { insertGamesBatch, updateGamesLikesBatch } from "@/lib/db";
import type { GameCardProps } from "@/types/cards";
import type { Likes } from "@/types/db";
import { classifyError } from "@/utilities/errorHandler";

export async function drainLikes(): Promise<{ processed: number }> {
  try {
    const likes = await drain<Likes>("neon", "likes");
    if (likes.length === 0) {
      return { processed: 0 };
    }
    const likesMap = new Map<string, number>();
    for (const like of likes) {
      likesMap.set(like.id, (likesMap.get(like.id) || 0) + like.likesDelta);
    }
    await updateGamesLikesBatch(likesMap);
    return { processed: likes.length };
  } catch (error) {
    const classified = classifyError(error, "pull.drainLikes");
    console.error("drainLikes failed:", classified.message);
    throw error;
  }
}

export async function drainGames(): Promise<{ processed: number }> {
  try {
    const games = await drain<GameCardProps>("neon", "games");
    if (games.length === 0) {
      return { processed: 0 };
    }
    await insertGamesBatch(games);
    return { processed: games.length };
  } catch (error) {
    const classified = classifyError(error, "pull.drainGames");
    console.error("drainGames failed:", classified.message);
    throw error;
  }
}
