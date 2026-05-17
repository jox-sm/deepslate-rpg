import { NextResponse } from 'next/server';
import { convertComponentImagesJSON } from '@/utilities/insertGameImages';
import { GamesFormData as GameData } from "@/types/gameForm";
import { GameDataJSON } from "@/types/gamedata";

export async function POST(req: Request) {
  try {
    const gameData: GameDataJSON = await req.json();
    console.log("gameData:", JSON.stringify(gameData));
    const dbGameData = await convertComponentImagesJSON(gameData);
    console.log("dbGameData:", JSON.stringify(dbGameData));
    return NextResponse.json(dbGameData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "game upload went wrong" }, { status: 500 });
  }
}

