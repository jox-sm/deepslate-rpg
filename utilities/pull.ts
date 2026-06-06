import { NextResponse } from 'next/server';
import { getGamesQueue, getLikesQueue } from '@/utilities/db';
import { insertGamesBatch, updateGamesLikesBatch } from '@/lib/db';
import { redis } from '@/lib/queue';
import { sleep } from '@/utilities/sleep';
import { tryApiRoute } from '@/utilities/apiErrorHandler';

export async function processPull() {
  await sleep(850);
  await redis.rpop('load', '1');
  await sleep(150);
  const games = await getGamesQueue();
  const likes = await getLikesQueue();
  if (games.length > 0) {
    await insertGamesBatch(games);
  }
  if (likes.length > 0) {
    const likesMap = new Map<string, number>();
    likes.forEach(like => {
      const currentCount = likesMap.get(like.id) || 0;
      likesMap.set(like.id, currentCount + like.likesDelta);
    });
    await updateGamesLikesBatch(likesMap);
  }
  return { message: 'Data processed successfully' };
}

export const GET = tryApiRoute(processPull, "pull");