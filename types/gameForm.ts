export interface CharacterData {
  id: string;
  name: string;
  description: string;
  image: File | null;
  imagePreview: string;
}

export interface MapData {
  id: string;
  nameOfPlace: string;
  image: File | null;
  imagePreview: string;
  sizeOfPlace: string;
  placesAtMap: string;
}

export interface ItemData {
  id: string;
  name: string;
  image: File | null;
  imagePreview: string;
}

export interface GamesFormData {
  id: string;
  characters: CharacterData[];
  maps: MapData[];
  items: ItemData[];
}

export type GamesFormStep = "characters" | "maps" | "items";

export interface StepConfig {
  key: GamesFormStep;
  title: string;
  maxItems?: number;
}

export const GAMES_FORM_STEPS: StepConfig[] = [
  { key: "characters", title: "Characters", maxItems: 20 },
  { key: "maps", title: "Maps", maxItems: 20 },
  { key: "items", title: "Items", maxItems: 50 },
];

export const CHARACTER_VALIDATION = {
  name: { minLength: 4, maxLength: 50, fieldName: "Character Name" },
  description: { minLength: 50, maxLength: 300, fieldName: "Character Description" },
} as const;

export const MAP_VALIDATION = {
  nameOfPlace: { minLength: 4, maxLength: 50, fieldName: "Place Name" },
  sizeOfPlace: { minLength: 2, maxLength: 50, fieldName: "Size" },
  placesAtMap: { minLength: 10, maxLength: 500, fieldName: "Places" },
} as const;

export const ITEM_VALIDATION = {
  name: { minLength: 1, maxLength: 50, fieldName: "Item Name" },
} as const;

export const initialFormData: GamesFormData = {
  id: "",
  characters: [],
  maps: [],
  items: [],
};

export interface UseGamesFormReturn {
  currentStep: number;
  formData: GamesFormData;
  stepKey: GamesFormStep;
  isFirstStep: boolean;
  isLastStep: boolean;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateField: <K extends keyof GamesFormData>(field: K, value: GamesFormData[K]) => void;
  reset: () => void;
  addCharacter: () => void;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, field: keyof CharacterData, value: unknown) => void;
  addMap: () => void;
  removeMap: (id: string) => void;
  updateMap: (id: string, field: keyof MapData, value: unknown) => void;
  addItem: () => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, field: keyof ItemData, value: unknown) => void;
}


export type CharacterDataDB = Omit<CharacterData, 'image' | 'imagePreview'> & {
  image: string;
}

export type MapDataDB = Omit<MapData, 'image' | 'imagePreview'> & {
  image: string;
}

export type ItemDataDB = Omit<ItemData, 'image' | 'imagePreview'> & {
  image: string;
}

export type GamesFormDataDB = Omit<GamesFormData, 'characters' | 'maps' | 'items'> & {
  characters: CharacterDataDB[];
  maps: MapDataDB[];
  items: ItemDataDB[];
}

