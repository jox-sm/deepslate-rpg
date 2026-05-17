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
      await sleep(150);
      await Game.insertMany(gamesQueue, { ordered: false });

      await setToIdle();
    } 
  } catch (error) {
    console.error('Error processing games queue:', error);
  }
}