import {validateQueue, setToIdle, getGamesQueue} from "@/utilities/insertGame";
import connectDB from "@/models/games/mongodb/client";
import Game from "@/models/games/mongodb/schema";
import { sleep } from "@/utilities/sleep";
import { classifyError } from '@/utilities/errorHandler';

export async function processGamesQueue() {
  try {
    if (await validateQueue()) {
      await connectDB();
      await sleep(850);
      const gamesQueue = await getGamesQueue();
      console.log("\n\n\n Processing games queue, number of games to insert:", gamesQueue.length);
      await sleep(150);
      await Game.insertMany(gamesQueue, { ordered: false });
      console.log("Finished processing games queue");
      await setToIdle();
    } 
  } catch (error) {
    const classified = classifyError(error, "GamesInsert.processGamesQueue");
    console.error('Error processing games queue:', classified.message);
  }
}