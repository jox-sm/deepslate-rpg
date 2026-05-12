import { redis } from '@/lib/queue';
import { Likes } from '@/types/db';
import {GameCardProps} from '@/types/cards';

export async function pushGameToQueue(taskData: GameCardProps) {
  const payload = JSON.stringify({
    ...taskData,
    timestamp: Date.now(),
  });
  
  await redis.rpush('InsertGames', payload);
}

export async function PushLikesToQueue(taskData: Likes) {
  const payload = JSON.stringify({
    ...taskData,
    timestamp: Date.now(),
  });
  
  await redis.rpush('InsertLikes', payload);
}