export interface CharacterDataJSON {
  id: string;
  name: string;
  description: string;
  image: string | null;
  imagePreview: string;
}

export interface MapDataJSON {
  id: string;
  nameOfPlace: string;
  image: string | null;
  imagePreview: string;
  sizeOfPlace: string;
  placesAtMap: string;
}

export interface ItemDataJSON {
  id: string;
  name: string;
  image: string | null;
  imagePreview: string;
}

export interface GameDataJSON {
  id: string;
  characters: CharacterDataJSON[];
  maps: MapDataJSON[];
  items: ItemDataJSON[];
}