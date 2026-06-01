import { NextRequest, NextResponse } from 'next/server';
import { validateQueue, setToWorking, setToIdle, validateQueueWorking, pushGameToQueue } from "@/utilities/insertGame";
import { processGamesQueue } from "@/lib/GamesInsert";
import { retry } from '@/lib/retry';
import { GamesFormDataDB } from "@/types/gameForm";
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function POST(request: NextRequest) {
  // Validate JWT token
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { idempotencyKey, ...gameData } = body;

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing idempotencyKey' },
        { status: 400 }
      );
    }

    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
      const dbGameData: GamesFormDataDB = gameData;
      console.log("hello from push games \n\n\n dbGameData:");
      await retry(() => pushGameToQueue(dbGameData), 3, 500); 
      
      if (await retry(() => validateQueueWorking(), 3, 500)) {
        return { success: true, message: 'Game data successfully pushed to Redis queue and is being processed' };
      } else {
        await retry(() => setToWorking(), 3, 500);
        await retry(() => processGamesQueue(), 3, 500);
        return { success: true, message: 'Game data successfully pushed to Redis queue' };
      }
    });

    return NextResponse.json({
      ...result,
      idempotencyKey,
      cached,
    });
  } catch (error: any) {
    console.error('Redis Push Error:', error);
    return NextResponse.json(
      { error: 'Failed to push to queue', details: error.message },
      { status: 500 }
    );
  }
}