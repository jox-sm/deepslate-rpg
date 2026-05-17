import { NextResponse } from 'next/server';
import { convertComponentImagesJSON } from '@/utilities/insertGameImages';
import { GamesFormDataDB } from "@/types/gameForm";

export async function POST(req: Request) {
  try {
    const gameData: GamesFormDataDB = await req.json();
    const dbGameData = await convertComponentImagesJSON(gameData);
    return NextResponse.json(dbGameData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "game upload went wrong" }, { status: 500 });
  }
}

