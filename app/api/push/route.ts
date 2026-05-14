import { NextResponse } from 'next/server';
import { pushGameToQueue, PushLikesToQueue } from '@/utilities/db';
import { Likes } from '@/types/db';
import { GameCardProps } from '@/types/cards';
import { GET } from '@/utilities/pull';



export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;
    if (type === 'game') {
      const gameData: GameCardProps = {
        id: data.id,
        name: data.name,
        description: data.description,
        likes_count: data.likes_count || 0,
        image: data.image,
        tags: data.tags,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      
      await pushGameToQueue(gameData);
      await GET();
      return NextResponse.json({
        success: true,
        message: 'Game added to queue',
        data: gameData,
      });
    }
    
    if (type === 'like') {
      const likeData: Likes = {
        id: data.id,
        likesDelta: data.likesDelta,
      };
      
      await PushLikesToQueue(likeData);
      await GET();
      return NextResponse.json({
        success: true,
        message: 'Like added to queue',
        data: likeData,
      });
    }

    return NextResponse.json(
      { error: 'Invalid type. Use "game" or "like"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error pushing to Redis:', error);
    return NextResponse.json(
      { error: 'Failed to push data to Redis' },
      { status: 500 }
    );
  }
}