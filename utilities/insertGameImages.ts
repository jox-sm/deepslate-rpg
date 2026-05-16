import { uploadImage } from '@/lib/storage';
import { GamesFormData as GameData, GamesFormDataDB as dbGameData } from "@/types/gameForm";

export async function convertComponentImages(gameData: GameData): Promise<dbGameData> {
  const characters = await Promise.all(
    gameData.characters.map(async (char) => ({
      id: char.id,
      name: char.name,
      description: char.description,
      image: char.image ? await uploadImage(await convertImageUrlToBuffer(char.image), char.name) : "null",
    }))
  );
  
  const maps = await Promise.all(
    gameData.maps.map(async (map) => ({
      id: map.id,
      nameOfPlace: map.nameOfPlace,
      image: map.image ? await uploadImage(await convertImageUrlToBuffer(map.image), map.nameOfPlace) : "null",
      sizeOfPlace: map.sizeOfPlace,
      placesAtMap: map.placesAtMap,
    }))
  );

  const items = await Promise.all(
    gameData.items.map(async (item) => ({
      id: item.id,
      name: item.name,
      image: item.image ? await uploadImage(await convertImageUrlToBuffer(item.image), item.name) : "null",
    }))
  );

  const dbGamedata: dbGameData = {
    id: gameData.id,
    characters,
    maps,
    items,
  };

  return dbGamedata;
}

async function convertImageUrlToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}