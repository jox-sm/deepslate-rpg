import { drain, enqueue } from "@/utilities/queue";
import { redis } from "@/lib/queue";
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
    const ids = new Set<string>();
    for (const like of likes) {
      likesMap.set(like.id, (likesMap.get(like.id) || 0) + like.likesDelta);
      ids.add(like.id);
    }

    // drain() has already consumed the queue, so a failed write would drop
    // these likes on the floor forever. Put them back before rethrowing.
    try {
      await updateGamesLikesBatch(likesMap);
    } catch (error) {
      await Promise.all(
        likes.map((like) => enqueue("neon", "likes", like).catch(() => undefined))
      );
      throw error;
    }

    // Remove only the delta that was actually applied. A blanket DEL also
    // wiped likes that arrived while this drain was in flight, so the count
    // on screen would drop back down a moment after the user clicked.
    await Promise.all(
      [...likesMap.entries()].map(async ([id, applied]) => {
        const key = `likes:${id}`;
        try {
          const remaining = await redis.decrby(key, applied);
          if (remaining < 0) await redis.set(key, 0);
        } catch (error) {
          const classified = classifyError(error, `pull.drainLikes.cleanup.${id}`);
          console.error('[Pull] pending-likes cleanup failed:', classified.message);
        }
      })
    );

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
