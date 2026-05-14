import { redis } from '@/lib/queue';
import { Likes } from '@/types/db';
import {GameCardProps} from '@/types/cards';

export async function pushGameToQueue(taskData: GameCardProps) {
  const payload = JSON.stringify({
    ...taskData,
    timestamp: Date.now(),
  });
  
  await redis.rpush('InsertGames', payload);
  if(await validateQueue()){
    return;
  }else{
    await pushToQueue();
  }
}

export async function PushLikesToQueue(taskData: Likes) {
  const payload = JSON.stringify({
    ...taskData,
    timestamp: Date.now(),
  });
  
  await redis.rpush('InsertLikes', payload);
   if(await validateQueue()){
    return;
  }else{
    await pushToQueue();
  }
}


export async function getGamesQueue() {
  const tempKey = `InsertGames:processing:${Date.now()}`;

  try {
    await redis.rename('InsertGames', tempKey);

    const allGames = await redis.lrange(tempKey, 0, -1);

    if (allGames.length > 0) {
      const parsedGames = allGames.map(game => JSON.parse(game));
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

export async function getLikesQueue() {
  const tempKey = `InsertLikes:processing:${Date.now()}`;

  try {
    await redis.rename('InsertLikes', tempKey);

    const allLikes = await redis.lrange(tempKey, 0, -1);

    if (allLikes.length > 0) {
      const parsedLikes = allLikes.map(like => JSON.parse(like));
      await redis.del(tempKey);

      return parsedLikes;
    }

    return [];

  } catch (err) {
    if (err instanceof Error && err.message.includes('no such key')) {
      return [];
    }
    throw err;
  }
}

export async function pushToQueue(){
  await redis.rpush('load', '1');
}
export async function validateQueue(){
  const length = await redis.llen('load');
  return length > 0;
}


