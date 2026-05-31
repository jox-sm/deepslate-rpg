import { NextRequest, NextResponse } from 'next/server';
import { pushGameToQueue, PushLikesToQueue } from '@/utilities/db';
import { Likes } from '@/types/db';
import { GameCardProps } from '@/types/cards';
import { GET } from '@/utilities/pull';
import { retry } from '@/lib/retry';
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';

export async function POST(request: NextRequest) {
   // Validate JWT token via Clerk
   const { error } = await validateJWTMiddleware(request);
   if (error) return error;

   // Apply rate limiting
   try {
     await rateLimitMiddleware(request);
   } catch {
     return NextResponse.json(
       { error: 'Rate limit exceeded' },
       { status: 429 }
     );
   }

   try {
     const body = await request.json();
     
     // Validate request body with Zod
     const pushRequestSchema = z.object({
       idempotencyKey: z.string().uuid(),
       type: z.enum(['game', 'like']),
       data: z.any() // We'll validate the data structure inside each type handler
     });
     
     const validationResult = pushRequestSchema.safeParse(body);
     if (!validationResult.success) {
       return NextResponse.json(
         { error: 'Invalid request body', details: validationResult.error.issues },
         { status: 400 }
       );
     }
     
     const { idempotencyKey, type, data } = validationResult.data;

    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
     if (type === 'game') {
         // Validate game data structure
         const gameSchema = z.object({
           id: z.string().uuid(),
           name: z.string().min(1).max(255),
           description: z.string().min(1).max(5000),
           image: z.string().url().optional(),
           tags: z.array(z.string().max(50)).max(10),
           likes_count: z.number().int().min(0).optional(),
           created_at: z.string().datetime(),
           updated_at: z.string().datetime()
         });
         
         const gameValidation = gameSchema.safeParse(data);
         if (!gameValidation.success) {
           return NextResponse.json(
             { error: 'Invalid game data', details: gameValidation.error.issues },
             { status: 400 }
           );
         }
         
         const gameData: GameCardProps = {
           id: gameValidation.data.id,
           name: gameValidation.data.name,
           description: gameValidation.data.description,
           likes_count: gameValidation.data.likes_count || 0,
            image: gameValidation.data.image || '',
           tags: gameValidation.data.tags,
           created_at: gameValidation.data.created_at,
           updated_at: gameValidation.data.updated_at,
         };
         
         await retry(() => pushGameToQueue(gameData), 3, 500);
         await GET();
         return { success: true, message: 'Game added to queue', data: gameData };
       }
      
       if (type === 'like') {
         // Validate like data structure
         const likeSchema = z.object({
           id: z.string().uuid(),
           likesDelta: z.number().int()
         });
         
         const likeValidation = likeSchema.safeParse(data);
         if (!likeValidation.success) {
           return NextResponse.json(
             { error: 'Invalid like data', details: likeValidation.error.issues },
             { status: 400 }
           );
         }
         
         const likeData: Likes = {
           id: likeValidation.data.id,
           likesDelta: likeValidation.data.likesDelta,
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