import { NextRequest, NextResponse } from 'next/server';
import { pushGameToQueue, PushLikesToQueue } from '@/utilities/db';
import { GET } from '@/utilities/pull';
import { retry } from '@/lib/retry';
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';
import { pushRequestSchema, pushGameDataSchema, likesSchema } from '@/types/validation';

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
          const gameValidation = pushGameDataSchema.safeParse(data);
          if (!gameValidation.success) {
            return NextResponse.json(
              { error: 'Invalid game data', details: gameValidation.error.issues },
              { status: 400 }
            );
          }
          
           const gameData = {
             ...gameValidation.data,
             image: gameValidation.data.image || '',
             likes_count: gameValidation.data.likes_count ?? 0,
           };
          
          await retry(() => pushGameToQueue(gameData), 3, 500);
         await GET();
         return { success: true, message: 'Game added to queue', data: gameData };
       }
      
      if (type === 'like') {
          const likeValidation = likesSchema.safeParse(data);
          if (!likeValidation.success) {
            return NextResponse.json(
              { error: 'Invalid like data', details: likeValidation.error.issues },
              { status: 400 }
            );
          }
          
          const likeData = likeValidation.data;
         
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