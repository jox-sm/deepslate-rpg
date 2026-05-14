import { NextResponse } from 'next/server';
import { getGamesQueue, getLikesQueue } from '@/utilities/db';
import { insertGamesBatch, updateGamesLikesBatch } from '@/lib/db';
import { redis } from '@/lib/queue'; 


export async function GET() {
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));  
  await sleep(850);

  try {
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
    return NextResponse.json({ message: 'Data processed successfully' });
  } catch (error) {
    console.error('Error fetching from Redis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Redis' },
      { status: 500 }
    );
  }
}

