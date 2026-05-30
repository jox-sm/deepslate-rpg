import { uploadImage } from '@/lib/storage';
import { GamesFormDataDB as dbGameData, CharacterDataDB, MapDataDB, ItemDataDB } from "@/types/gameForm";
import { convertDataUrlToBinary } from './imagesUtils';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function convertComponentImagesJSON(
  gameData: dbGameData,
  authenticatedClient?: SupabaseClient
): Promise<dbGameData> {
  // Process characters with individual error handling
  const characters: CharacterDataDB[] = [];
  for (const char of gameData.characters) {
    try {
      const image = await uploadImage(
        await convertImageToBuffer(char.image), 
        char.name,
        undefined,
        authenticatedClient
      );
      characters.push({
        id: char.id,
        name: char.name,
        description: char.description,
        image,
      });
    } catch (error) {
      console.error(`Failed to upload image for character ${char.name}:`, error);
      // Keep the original image data (base64/data URL) as fallback
      characters.push({
        id: char.id,
        name: char.name,
        description: char.description,
        image: char.image, // fallback to original data
      });
    }
  }
  
  // Process maps with individual error handling
  const maps: MapDataDB[] = [];
  for (const map of gameData.maps) {
    try {
      const image = await uploadImage(
        await convertImageToBuffer(map.image), 
        map.nameOfPlace,
        undefined,
        authenticatedClient
      );
      maps.push({
        id: map.id,
        nameOfPlace: map.nameOfPlace,
        image,
        sizeOfPlace: map.sizeOfPlace,
        placesAtMap: map.placesAtMap,
      });
    } catch (error) {
      console.error(`Failed to upload image for map ${map.nameOfPlace}:`, error);
      // Keep the original image data as fallback
      maps.push({
        id: map.id,
        nameOfPlace: map.nameOfPlace,
        image: map.image, // fallback to original data
        sizeOfPlace: map.sizeOfPlace,
        placesAtMap: map.placesAtMap,
      });
    }
  }
  
  // Process items with individual error handling
  const items: ItemDataDB[] = [];
  for (const item of gameData.items) {
    try {
      const image = await uploadImage(
        await convertImageToBuffer(item.image), 
        item.name,
        undefined,
        authenticatedClient
      );
      items.push({
        id: item.id,
        name: item.name,
        image,
      });
    } catch (error) {
      console.error(`Failed to upload image for item ${item.name}:`, error);
      // Keep the original image data as fallback
      items.push({
        id: item.id,
        name: item.name,
        image: item.image, // fallback to original data
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

async function convertImageToBuffer(blobUrl: string): Promise<Buffer> {
  const arrayBuffer = await convertDataUrlToBinary(blobUrl);
  return Buffer.from(arrayBuffer);
}