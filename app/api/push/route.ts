import { NextRequest, NextResponse } from 'next/server';
import { pushGameToQueue, PushLikesToQueue } from '@/utilities/db';
import { Likes } from '@/types/db';
import { GameCardProps } from '@/types/cards';
import { GET } from '@/utilities/pull';
import { retry } from '@/lib/retry';
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function POST(request: NextRequest) {
  // Validate JWT token
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { idempotencyKey, type, data } = body;

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing idempotencyKey' },
        { status: 400 }
      );
    }

    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
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
        
        await retry(() => pushGameToQueue(gameData), 3, 500);
        await GET();
        return { success: true, message: 'Game added to queue', data: gameData };
      }
      
      if (type === 'like') {
        const likeData: Likes = {
          id: data.id,
          likesDelta: data.likesDelta,
        };
        
        await retry(() => PushLikesToQueue(likeData), 3, 500);
        await GET();
        return { success: true, message: 'Like added to queue', data: likeData };
      }

      return { success: false, error: 'Invalid type. Use "game" or "like"' };
    });

    return NextResponse.json({
      ...result,
      idempotencyKey,
      cached,
    });
  } catch (error) {
    console.error('Error pushing to Redis:', error);
    return NextResponse.json(
      { error: 'Failed to push data to Redis' },
      { status: 500 }
    );
  }
}