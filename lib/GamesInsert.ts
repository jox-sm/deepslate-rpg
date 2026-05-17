import {validateQueue, setToIdle, getGamesQueue} from "@/utilities/insertGame";
import connectDB from "@/models/games/mongodb/client";
import Game from "@/models/games/mongodb/schema";

export async function processGamesQueue() {
  try {
    if (await validateQueue()) {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));  
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
    console.error('Error processing games queue:', error);
  }
}