import { NextResponse } from 'next/server';
import {validateQueue, setToWorking, setToIdle, validateQueueWorking, pushGameToQueue} from "@/utilities/insertGame";
import {processGamesQueue} from "@/lib/GamesInsert";
export async function POST(request: Request) {
  try {
    const dbGameData = await request.json();
    await pushGameToQueue(dbGameData); 
    if(await validateQueueWorking()){
      return NextResponse.json({
        success: true,
        message: 'Game data successfully pushed to Redis queue and is being processed',
      });
    }else{
        await setToWorking();
        await processGamesQueue();
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