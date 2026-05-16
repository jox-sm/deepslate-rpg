import {validateQueue, setToIdle, getGamesQueue} from "@/utilities/insertGame";
import connectDB from "@/models/games/mongodb/client";
import Game from "@/models/games/mongodb/schema";

export async function processGamesQueue() {
  try {
    if (await validateQueue()) {
      await connectDB();
      const gamesQueue = await getGamesQueue();
      await Game.insertMany(gamesQueue, { ordered: false });
      await setToIdle();
    } 
  } catch (error) {
    console.error('Error processing games queue:', error);
  }
}