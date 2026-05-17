import { validateText } from "@/utilities/FormUtils";
import {
  CHARACTER_VALIDATION,
  MAP_VALIDATION,
  ITEM_VALIDATION,
  type CharacterData,
  type MapData,
  type ItemData,
  type ValidationConfig,
} from "@/types/form";

type ValidationResult = ReturnType<typeof validateText>;

type ValidationFn = (value: string) => ValidationResult;

function createFieldValidator(config: ValidationConfig): ValidationFn {
  return (value: string) => validateText(value, config);
}

export const characterValidators = {
  name: createFieldValidator(CHARACTER_VALIDATION.name),
  description: createFieldValidator(CHARACTER_VALIDATION.description),
};

export const mapValidators = {
  nameOfPlace: createFieldValidator(MAP_VALIDATION.nameOfPlace),
  sizeOfPlace: createFieldValidator(MAP_VALIDATION.sizeOfPlace),
  placesAtMap: createFieldValidator(MAP_VALIDATION.placesAtMap),
};

export const itemValidators = {
  name: createFieldValidator(ITEM_VALIDATION.name),
};

export function validateCharacter(char: CharacterData): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const nameResult = characterValidators.name(char.name);
  const descResult = characterValidators.description(char.description);

  if (!nameResult.isFormValid) errors.name = nameResult.errorMessage;
  if (!descResult.isFormValid) errors.description = descResult.errorMessage;

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateMap(map: MapData): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const nameResult = mapValidators.nameOfPlace(map.nameOfPlace);
  const sizeResult = mapValidators.sizeOfPlace(map.sizeOfPlace);
  const placesResult = mapValidators.placesAtMap(map.placesAtMap);

  if (!nameResult.isFormValid) errors.nameOfPlace = nameResult.errorMessage;
  if (!sizeResult.isFormValid) errors.sizeOfPlace = sizeResult.errorMessage;
  if (!placesResult.isFormValid) errors.placesAtMap = placesResult.errorMessage;

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateItem(item: ItemData): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const nameResult = itemValidators.name(item.name);

  if (!nameResult.isFormValid) errors.name = nameResult.errorMessage;

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateCharactersList(characters: CharacterData[]): { isValid: boolean; errors: Record<string, string>[] } {
  const results = characters.map((char) => validateCharacter(char));
  return { isValid: results.every((r) => r.isValid), errors: results.map((r) => r.errors) };
}

export function validateMapsList(maps: MapData[]): { isValid: boolean; errors: Record<string, string>[] } {
  const results = maps.map((map) => validateMap(map));
  return { isValid: results.every((r) => r.isValid), errors: results.map((r) => r.errors) };
}

export function validateItemsList(items: ItemData[]): { isValid: boolean; errors: Record<string, string>[] } {
  const results = items.map((item) => validateItem(item));
  return { isValid: results.every((r) => r.isValid), errors: results.map((r) => r.errors) };
}