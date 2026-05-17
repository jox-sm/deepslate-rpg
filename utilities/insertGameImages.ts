import { uploadImage } from '@/lib/storage';
import { GamesFormDataDB as dbGameData } from "@/types/gameForm";
import { GameDataJSON } from "@/types/gamedata";

export type { GameDataJSON };

export async function convertComponentImages(gameData: GameDataJSON): Promise<dbGameData> {
  const characters = await Promise.all(
    gameData.characters.map(async (char) => ({
      id: char.id,
      name: char.name,
      description: char.description,
      image: char.image ? await uploadImage(await convertImageToBuffer(char.image), char.name) : "null",
    }))
  );
  
  const maps = await Promise.all(
    gameData.maps.map(async (map) => ({
      id: map.id,
      nameOfPlace: map.nameOfPlace,
      image: map.image ? await uploadImage(await convertImageToBuffer(map.image), map.nameOfPlace) : "null",
      sizeOfPlace: map.sizeOfPlace,
      placesAtMap: map.placesAtMap,
    }))
  );

  const items = await Promise.all(
    gameData.items.map(async (item) => ({
      id: item.id,
      name: item.name,
      image: item.image ? await uploadImage(await convertImageToBuffer(item.image), item.name) : "null",
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

export async function convertComponentImagesJSON(gameData: GameDataJSON): Promise<dbGameData> {
  const characters = await Promise.all(
    gameData.characters.map(async (char) => ({
      id: char.id,
      name: char.name,
      description: char.description,
      image: char.image ? await uploadImage(await convertImageToBuffer(char.image), char.name) : "null",
    }))
  );
  
  const maps = await Promise.all(
    gameData.maps.map(async (map) => ({
      id: map.id,
      nameOfPlace: map.nameOfPlace,
      image: map.image ? await uploadImage(await convertImageToBuffer(map.image), map.nameOfPlace) : "null",
      sizeOfPlace: map.sizeOfPlace,
      placesAtMap: map.placesAtMap,
    }))
  );

  const items = await Promise.all(
    gameData.items.map(async (item) => ({
      id: item.id,
      name: item.name,
      image: item.image ? await uploadImage(await convertImageToBuffer(item.image), item.name) : "null",
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

async function convertImageToBuffer(base64: string): Promise<Buffer> {
  const base64Data = base64.split(',')[1];
  return Buffer.from(base64Data, 'base64');
}