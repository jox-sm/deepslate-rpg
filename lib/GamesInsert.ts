import { drain, enqueue } from "@/utilities/queue";
import connectDB from "@/models/games/mongodb/client";
import Game from "@/models/games/mongodb/schema";
import { classifyError } from "@/utilities/errorHandler";
import type { GamesFormDataDB } from "@/types/gameForm";

export async function processGamesQueue(): Promise<{ processed: number }> {
  try {
    await connectDB();
    const gamesQueue = await drain<GamesFormDataDB>("mongodb", "games");
    if (gamesQueue.length === 0) {
      return { processed: 0 };
    }
    console.log("\n\n\n Processing games queue, number of games to insert:", gamesQueue.length);
    try {
      await Game.insertMany(gamesQueue, { ordered: false });
    } catch (error) {
      // drain() already consumed the queue, so a failed insert would drop
      // these games on the floor. Put them back before rethrowing.
      await Promise.all(
        gamesQueue.map((game) => enqueue("mongodb", "games", game).catch(() => undefined))
      );
      throw error;
    }
    console.log("Finished processing games queue");
    return { processed: gamesQueue.length };
  } catch (error) {
    const classified = classifyError(error, "GamesInsert.processGamesQueue");
    console.error("Error processing games queue:", classified.message);
    throw error;
  }
}
