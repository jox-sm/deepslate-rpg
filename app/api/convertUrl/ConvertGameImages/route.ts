import { NextResponse } from 'next/server';
import { convertComponentImages } from '@/utilities/insertGameImages';
import { GamesFormData as GameData } from "@/types/gameForm";
import { GameDataJSON } from "@/types/gamedata";

export async function POST(req: Request) {
  try {
    const gameData: GameDataJSON = await req.json();
    const dbGameData = await convertComponentImages(gameData);
    return NextResponse.json(dbGameData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "game upload went wrong" }, { status: 500 });
  }
}

