import { redis } from '@/lib/queue';
import {  GamesFormDataDB as dbGameData } from "@/types/gameForm";


export async function validateQueue(): Promise<boolean> {
  const gamesQueueLength = await redis.llen('InsertGames');
  return gamesQueueLength > 0;
}
export async function validateQueueWorking(): Promise<boolean> {
  const workingLength = await redis.llen('InsertGames:active');
  return workingLength > 0;
}

export async function pushGameToQueue(gameData: dbGameData): Promise<void> {
  const payload = JSON.stringify({
    ...gameData,
    timestamp: Date.now(),
  });
  await redis.rpush('InsertGames', payload);
}


export async function setToWorking(): Promise<void> {
  await redis.rpush('InsertGames:active', "True");
}
export async function setToIdle(): Promise<void> {
  await redis.rpop('InsertGames:active',"True");
}



export async function getGamesQueue() {
  const tempKey = `InsertGames:processing:${Date.now()}`;

  try {
    await redis.rename('InsertGames', tempKey);

    const allGames = await redis.lrange(tempKey, 0, -1);

    if (allGames.length > 0) {
      const parsedGames = allGames.map(dbGameData => JSON.parse(dbGameData));
      //later we add a retry mechanism here to requeue failed tasks, for now we just delete the temp key after processing

      //also we leave some space here so we later log everything that is being processed.
      await redis.del(tempKey); 

      return parsedGames; 
    }
    
    return [];
    
  } catch (err) {
    if (err instanceof Error && err.message.includes('no such key')) {
      return []; 
    }
    throw err;
  }
}