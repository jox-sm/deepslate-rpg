"use client";

import type { CharacterData, GamesFormData, ItemData, MapData } from "@/types/gameForm";
import { dataUrlToBuffer } from "@/utilities/clientUtilities/imagesUtils";

/**
 * Draft storage for the game-creation form.
 *
 * The wizard holds uploaded images as ArrayBuffers in React state. That state
 * dies with the component, so navigating back to a step (which unmounts and
 * remounts the step component) used to blank the image preview, and a page
 * reload lost the whole draft.
 *
 * Images are persisted as data URLs (see `bufferToDataUrl`) because:
 *   - a blob URL is revoked when the component that created it unmounts
 *   - an ArrayBuffer cannot be serialised to JSON
 *
 * The draft is scoped to game creation only. It is cleared as soon as a game
 * is successfully created, so a completed game never leaves data behind.
 */
const NAMESPACE = "deepslate:game-draft";
export const WIZARD_STORAGE_KEY = `${NAMESPACE}:wizard`;
export const FORM_STORAGE_KEY = `${NAMESPACE}:form`;

interface StoredEntry {
  id: string;
  name?: string;
  description?: string;
  nameOfPlace?: string;
  sizeOfPlace?: string;
  placesAtMap?: string;
  /** Data URL of the uploaded image, if any. */
  image?: string;
}

interface StoredWizard {
  characters: StoredEntry[];
  maps: StoredEntry[];
  items: StoredEntry[];
}

interface StoredForm {
  name: string;
  description: string;
  selectedTags: string[];
  /** Data URL of the cover image, if any. */
  image?: string;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded (localStorage is ~5MB and images are large). Drop the
    // images and keep the text so the draft is still recoverable.
    try {
      window.localStorage.setItem(key, JSON.stringify(value, stripImages));
      return true;
    } catch {
      return false;
    }
  }
}

/** JSON.stringify replacer that removes image payloads. */
function stripImages(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && "image" in (value as Record<string, unknown>)) {
    const clone = { ...(value as Record<string, unknown>) };
    delete clone.image;
    return clone;
  }
  return value;
}

function clearKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable - nothing to clear */
  }
}

/* ------------------------------------------------------------------ */
/* Wizard (characters / maps / items)                                 */
/* ------------------------------------------------------------------ */

export function saveWizardDraft(data: GamesFormData): boolean {
  const toStored = (entries: (CharacterData | MapData | ItemData)[]): StoredEntry[] =>
    entries.map((entry) => {
      const stored: StoredEntry = { id: entry.id };
      const anyEntry = entry as CharacterData & MapData & ItemData;
      if (anyEntry.name !== undefined) stored.name = anyEntry.name;
      if (anyEntry.description !== undefined) stored.description = anyEntry.description;
      if (anyEntry.nameOfPlace !== undefined) stored.nameOfPlace = anyEntry.nameOfPlace;
      if (anyEntry.sizeOfPlace !== undefined) stored.sizeOfPlace = anyEntry.sizeOfPlace;
      if (anyEntry.placesAtMap !== undefined) stored.placesAtMap = anyEntry.placesAtMap;
      // imagePreview is a data URL - it holds the bytes we need to restore
      // both the preview and the uploadable ArrayBuffer.
      if (anyEntry.imagePreview) stored.image = anyEntry.imagePreview;
      return stored;
    });

  const payload: StoredWizard = {
    characters: toStored(data.characters),
    maps: toStored(data.maps),
    items: toStored(data.items),
  };
  return writeJson(WIZARD_STORAGE_KEY, payload);
}

export function loadWizardDraft(): GamesFormData | null {
  const stored = readJson<StoredWizard>(WIZARD_STORAGE_KEY);
  if (!stored) return null;

  const restore = <T extends StoredEntry>(entries: T[] | undefined) =>
    (entries ?? []).map((entry) => {
      const restored = {
        ...entry,
        image: entry.image ? dataUrlToBuffer(entry.image) : null,
        imagePreview: entry.image ?? "",
      };
      return restored;
    });

  return {
    id: "",
    characters: restore(stored.characters) as CharacterData[],
    maps: restore(stored.maps) as MapData[],
    items: restore(stored.items) as ItemData[],
  };
}

export function clearWizardDraft() {
  clearKey(WIZARD_STORAGE_KEY);
}

/* ------------------------------------------------------------------ */
/* Cover form (name / description / tags / cover image)               */
/* ------------------------------------------------------------------ */

export function saveFormDraft(form: StoredForm): boolean {
  return writeJson(FORM_STORAGE_KEY, form);
}

export function loadFormDraft(): StoredForm | null {
  return readJson<StoredForm>(FORM_STORAGE_KEY);
}

export function clearFormDraft() {
  clearKey(FORM_STORAGE_KEY);
}

/** Clear the whole game-creation draft. Called after a successful create. */
export function clearGameDraft() {
  clearWizardDraft();
  clearFormDraft();
}
