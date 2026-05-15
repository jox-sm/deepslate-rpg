type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isValid?: boolean;
  minLength?: number;
  maxLength?: number;
  errorMessage?: string;
  statusColorClass?: string;
};

type TagsComponentProps = {
  label: string;
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
};

type ImageUploadProps = {
  label: string;
  onSelect: (file: File) => void;
  onPreviewChange?: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  resetKey?: number;
};

export type { TextAreaFieldProps, ImageUploadProps, TagsComponentProps };

// Games Form Types
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

export type ValidationConfig = {
  minLength: number;
  maxLength: number;
  fieldName: string;
};

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



