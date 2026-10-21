import { describe, it, expect } from "vitest";
import {
  validateCharacter,
  validateMap,
  validateItem,
  validateCharactersList,
  validateMapsList,
  validateItemsList,
} from "./gamesFormValidation";
import type { CharacterData, MapData, ItemData } from "@/types/gameForm";

const character = (over: Partial<CharacterData> = {}): CharacterData => ({
  id: "c1",
  name: "Mira Thorn",
  description:
    "A veteran delver with a lantern that never gutters and a map of every fallen hall she has ever walked.",
  image: null,
  imagePreview: "",
  ...over,
});

const map = (over: Partial<MapData> = {}): MapData => ({
  id: "m1",
  nameOfPlace: "Sunken Vault",
  image: null,
  imagePreview: "",
  sizeOfPlace: "Large",
  placesAtMap: "Entry hall, flooded archive, throne of echoes, collapsed stair",
  ...over,
});

const item = (over: Partial<ItemData> = {}): ItemData => ({
  id: "i1",
  name: "Ember Lantern",
  image: null,
  imagePreview: "",
  ...over,
});

describe("game form validators", () => {
  it("accepts valid character/map/item", () => {
    expect(validateCharacter(character()).isValid).toBe(true);
    expect(validateMap(map()).isValid).toBe(true);
    expect(validateItem(item()).isValid).toBe(true);
  });

  it("collects per-field errors", () => {
    const r = validateCharacter(character({ name: "x", description: "short" }));
    expect(r.isValid).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(["description", "name"]);
  });

  it("validates lists element-wise", () => {
    expect(validateCharactersList([character(), character()]).isValid).toBe(true);
    const bad = validateCharactersList([character(), character({ name: "" })]);
    expect(bad.isValid).toBe(false);
    expect(bad.errors).toHaveLength(2);
    expect(validateMapsList([map({ sizeOfPlace: "" })]).isValid).toBe(false);
    expect(validateItemsList([item(), item({ name: "" })]).isValid).toBe(false);
  });
});
