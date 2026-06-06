import { uploadImage } from '@/lib/storage';
import { GamesFormDataDB as dbGameData, CharacterDataDB, MapDataDB, ItemDataDB } from "@/types/gameForm";
import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyError } from '@/utilities/errorHandler';

export async function convertComponentImagesJSON(
  gameData: dbGameData,
  authenticatedClient?: SupabaseClient
): Promise<dbGameData> {
  const characters: CharacterDataDB[] = [];
  for (const char of gameData.characters) {
    try {
      const buffer = Buffer.from(char.image, 'base64');
      const image = await uploadImage(buffer, char.name, undefined, authenticatedClient);
      characters.push({
        id: char.id,
        name: char.name,
        description: char.description,
        image,
      });
    } catch (error) {
      const classified = classifyError(error, `insertGameImages.character.${char.name}`);
      console.error(`Failed to upload image for character ${char.name}:`, classified.message);
      characters.push({
        id: char.id,
        name: char.name,
        description: char.description,
        image: '',
      });
    }
  }

  const maps: MapDataDB[] = [];
  for (const map of gameData.maps) {
    try {
      const buffer = Buffer.from(map.image, 'base64');
      const image = await uploadImage(buffer, map.nameOfPlace, undefined, authenticatedClient);
      maps.push({
        id: map.id,
        nameOfPlace: map.nameOfPlace,
        image,
        sizeOfPlace: map.sizeOfPlace,
        placesAtMap: map.placesAtMap,
      });
    } catch (error) {
      const classified = classifyError(error, `insertGameImages.map.${map.nameOfPlace}`);
      console.error(`Failed to upload image for map ${map.nameOfPlace}:`, classified.message);
      maps.push({
        id: map.id,
        nameOfPlace: map.nameOfPlace,
        image: '',
        sizeOfPlace: map.sizeOfPlace,
        placesAtMap: map.placesAtMap,
      });
    }
  }

  const items: ItemDataDB[] = [];
  for (const item of gameData.items) {
    try {
      const buffer = Buffer.from(item.image, 'base64');
      const image = await uploadImage(buffer, item.name, undefined, authenticatedClient);
      items.push({
        id: item.id,
        name: item.name,
        image,
      });
    } catch (error) {
      const classified = classifyError(error, `insertGameImages.item.${item.name}`);
      console.error(`Failed to upload image for item ${item.name}:`, classified.message);
      items.push({
        id: item.id,
        name: item.name,
        image: '',
      });
    }
  }

  return {
    id: gameData.id,
    characters,
    maps,
    items,
  };
}