import { NextResponse } from 'next/server';
import {validateQueue, setToWorking, setToIdle, validateQueueWorking, pushGameToQueue} from "@/utilities/insertGame";
import {processGamesQueue} from "@/lib/GamesInsert";
import { retry } from '@/lib/retry';
import { GamesFormDataDB } from "@/types/gameForm";

export async function POST(request: Request) {
  try {
    const gameData: GamesFormDataDB = await request.json();
    console.log("hello from push games \n\n\n dbGameData:");
    await retry(() => pushGameToQueue(gameData), 3, 500); 
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