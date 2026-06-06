import type { CharacterDataJSON, MapDataJSON, ItemDataJSON } from "@/types/gamedata";

export type GamePatchOp = "add" | "remove" | "replace";

export type GameArrayKey = "characters" | "maps" | "items";

export type CharacterPatch =
  | { op: "add"; path: "/characters/-"; value: CharacterDataJSON }
  | { op: "remove"; path: `/characters/${string}` }
  | { op: "replace"; path: `/characters/${string}/name`; value: string }
  | { op: "replace"; path: `/characters/${string}/description`; value: string }
  | { op: "replace"; path: `/characters/${string}/image`; value: string };

export type MapPatch =
  | { op: "add"; path: "/maps/-"; value: MapDataJSON }
  | { op: "remove"; path: `/maps/${string}` }
  | { op: "replace"; path: `/maps/${string}/nameOfPlace`; value: string }
  | { op: "replace"; path: `/maps/${string}/sizeOfPlace`; value: string }
  | { op: "replace"; path: `/maps/${string}/placesAtMap`; value: string }
  | { op: "replace"; path: `/maps/${string}/image`; value: string };

export type ItemPatch =
  | { op: "add"; path: "/items/-"; value: ItemDataJSON }
  | { op: "remove"; path: `/items/${string}` }
  | { op: "replace"; path: `/items/${string}/name`; value: string }
  | { op: "replace"; path: `/items/${string}/image`; value: string };

export type GamePatch = CharacterPatch | MapPatch | ItemPatch;

export interface GamePatchRequest {
  id: string;
  patches: GamePatch[];
}

export interface GamePatchResult {
  index: number;
  op: GamePatchOp;
  path: string;
  status: "applied" | "skipped" | "error";
  error?: string;
}

export interface GamePatchResponse {
  gameId: string;
  applied: number;
  skipped: number;
  errors: number;
  results: GamePatchResult[];
}
