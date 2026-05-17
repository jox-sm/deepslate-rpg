import { NextResponse } from 'next/server';
import {validateQueue, setToWorking, setToIdle, validateQueueWorking, pushGameToQueue} from "@/utilities/insertGame";
import {processGamesQueue} from "@/lib/GamesInsert";
import { retry } from '@/lib/retry';
export async function POST(request: Request) {
  try {
    const dbGameData = await request.json();
    await retry(() => pushGameToQueue(dbGameData), 3, 500); 
    if(await retry(() => validateQueueWorking(), 3, 500)){
      return NextResponse.json({
        success: true,
        message: 'Game data successfully pushed to Redis queue and is being processed',
      });
    }else{
        await retry(() => setToWorking(), 3, 500);
        await retry(() => processGamesQueue(), 3, 500);
    }
    return NextResponse.json({
      success: true,
      message: 'Game data successfully pushed to Redis queue',
    });
  } catch (error: any) {
    console.error('Redis Push Error:', error);
    return NextResponse.json(
      { error: 'Failed to push to queue', details: error.message },
      { status: 500 }
    );
  }
}