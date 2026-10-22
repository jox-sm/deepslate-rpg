import { drain, enqueue } from "@/utilities/queue";
import connectDB from "@/models/games/mongodb/client";
import Game from "@/models/games/mongodb/schema";
import { classifyError } from "@/utilities/errorHandler";
import type { GamesFormDataDB } from "@/types/gameForm";

export interface GamesQueueResult {
  processed: number;
  skipped: number;
}

export async function processGamesQueue(): Promise<GamesQueueResult> {
  try {
    await connectDB();
    const gamesQueue = await drain<GamesFormDataDB>("mongodb", "games");
    if (gamesQueue.length === 0) {
      return { processed: 0, skipped: 0 };
    }

    // Validate before writing. insertMany() silently SKIPS documents that
    // fail schema validation, so a malformed game used to disappear with no
    // error at all while the API reported success. Filter them out here and
    // report them instead.
    const valid: GamesFormDataDB[] = [];
    for (const game of gamesQueue) {
      const validationError = new Game(game).validateSync();
      if (validationError) {
        console.error(
          `[GamesInsert] Skipping invalid game ${game?.id ?? "(no id)"}:`,
          validationError.message
        );
        continue;
      }
      valid.push(game);
    }

    const skipped = gamesQueue.length - valid.length;

    if (valid.length === 0) {
      console.error(`[GamesInsert] All ${skipped} queued game(s) failed validation - nothing written`);
      return { processed: 0, skipped };
    }

    try {
      // Upsert on `id` instead of insertMany: the `id` index is not unique,
      // so inserting the same game twice would leave two documents behind
      // and findOne({ id }) would return an arbitrary one of them.
      await Game.bulkWrite(
        valid.map((game) => ({
          updateOne: {
            filter: { id: game.id },
            update: {
              $set: {
                characters: game.characters,
                maps: game.maps,
                items: game.items,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    } catch (error) {
      // drain() already consumed the queue, so a failed write would drop
      // these games on the floor. Put them back before rethrowing.
      // Only genuine database failures reach this point - documents that
      // fail validation were filtered out above and are deliberately NOT
      // re-queued (that would loop forever on a poison payload).
      await Promise.all(
        valid.map((game) => enqueue("mongodb", "games", game).catch(() => undefined))
      );
      throw error;
    }

    if (skipped > 0) {
      console.error(`[GamesInsert] ${skipped} of ${gamesQueue.length} queued game(s) were invalid`);
    }

    console.log(`Finished processing games queue: ${valid.length} written, ${skipped} skipped`);
    return { processed: valid.length, skipped };
  } catch (error) {
    const classified = classifyError(error, "GamesInsert.processGamesQueue");
    console.error("Error processing games queue:", classified.message);
    throw error;
  }
}
