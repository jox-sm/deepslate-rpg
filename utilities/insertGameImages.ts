import { uploadImage } from '@/lib/storage';
import { GamesFormDataDB as dbGameData, CharacterDataDB, MapDataDB, ItemDataDB } from "@/types/gameForm";

export async function convertComponentImagesJSON(gameData: dbGameData): Promise<dbGameData> {
  const characters: CharacterDataDB[] = await Promise.all(
    gameData.characters.map(async (char) => ({
      id: char.id,
      name: char.name,
      description: char.description,
      image:await uploadImage(await convertImageToBuffer(char.image), char.name),
    }))
  );
  
  const maps: MapDataDB[] = await Promise.all(
    gameData.maps.map(async (map) => ({
      id: map.id,
      nameOfPlace: map.nameOfPlace,
      image: await uploadImage(await convertImageToBuffer(map.image), map.nameOfPlace),
      sizeOfPlace: map.sizeOfPlace,
      placesAtMap: map.placesAtMap,
    }))
  );

  const items: ItemDataDB[] = await Promise.all(
    gameData.items.map(async (item) => ({
      id: item.id,
      name: item.name,
      image: await uploadImage(await convertImageToBuffer(item.image), item.name),
    }))
  );

  return {
    id: gameData.id,
    characters,
    maps,
    items,
  };
}

async function convertImageToBuffer(blobUrl: string): Promise<Buffer> {
  const response = await fetch(blobUrl);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}