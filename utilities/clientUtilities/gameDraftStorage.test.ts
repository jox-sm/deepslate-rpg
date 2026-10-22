import { describe, it, expect, beforeEach } from "vitest";
import {
  arrayBufferToBase64,
  bufferToDataUrl,
  dataUrlToBuffer,
} from "@/utilities/clientUtilities/imagesUtils";
import {
  saveWizardDraft,
  loadWizardDraft,
  clearWizardDraft,
  saveFormDraft,
  loadFormDraft,
  clearFormDraft,
  clearGameDraft,
  WIZARD_STORAGE_KEY,
  FORM_STORAGE_KEY,
} from "@/utilities/clientUtilities/gameDraftStorage";
import { pushGamesRequestSchema, gameNestedDataSchema } from "@/types/validation";
import type { GamesFormData } from "@/types/gameForm";

const KEY = "019e370f-0173-703c-b4e1-bb027a921947";

function bufferOf(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("image data url helpers", () => {
  it("round trips an ArrayBuffer through a data URL", () => {
    const original = bufferOf([1, 2, 3, 4, 5, 250, 251, 252]);
    const dataUrl = bufferToDataUrl(original, "image/png");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);

    const restored = dataUrlToBuffer(dataUrl);
    expect(restored).not.toBeNull();
    expect(new Uint8Array(restored!)).toEqual(new Uint8Array(original));
  });

  it("produces the same payload as arrayBufferToBase64", () => {
    const original = bufferOf([10, 20, 30]);
    const dataUrl = bufferToDataUrl(original, "image/webp");
    expect(dataUrl.split(",")[1]).toBe(arrayBufferToBase64(original));
  });

  it("returns null for unusable input", () => {
    expect(dataUrlToBuffer("")).toBeNull();
    expect(dataUrlToBuffer("data:image/png;base64,!!!not-base64!!!")).toBeNull();
  });
});

describe("game draft storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and restores the wizard draft including images", () => {
    const image = bufferOf([1, 2, 3]);
    const dataUrl = bufferToDataUrl(image, "image/png");

    const data: GamesFormData = {
      id: "",
      characters: [
        {
          id: "c1",
          name: "Gandalf",
          description: "A wizard",
          image,
          imagePreview: dataUrl,
        },
      ],
      maps: [
        {
          id: "m1",
          nameOfPlace: "Rivendell",
          image: null,
          imagePreview: "",
          sizeOfPlace: "large",
          placesAtMap: "The garden",
        },
      ],
      items: [],
    };

    expect(saveWizardDraft(data)).toBe(true);

    const restored = loadWizardDraft();
    expect(restored).not.toBeNull();
    expect(restored!.characters).toHaveLength(1);
    expect(restored!.characters[0].name).toBe("Gandalf");
    // The preview comes back as the same data URL...
    expect(restored!.characters[0].imagePreview).toBe(dataUrl);
    // ...and the uploadable ArrayBuffer is rebuilt from it.
    expect(restored!.characters[0].image).not.toBeNull();
    expect(new Uint8Array(restored!.characters[0].image!)).toEqual(new Uint8Array(image));
    // Entries without an image stay in the draft with a null image.
    expect(restored!.maps[0].image).toBeNull();
    expect(restored!.maps[0].nameOfPlace).toBe("Rivendell");
    expect(restored!.items).toEqual([]);
  });

  it("returns null when there is no draft", () => {
    expect(loadWizardDraft()).toBeNull();
  });

  it("clears the wizard draft", () => {
    saveWizardDraft({
      id: "",
      characters: [{ id: "c1", name: "x", description: "y", image: null, imagePreview: "" }],
      maps: [],
      items: [],
    });
    expect(window.localStorage.getItem(WIZARD_STORAGE_KEY)).not.toBeNull();
    clearWizardDraft();
    expect(window.localStorage.getItem(WIZARD_STORAGE_KEY)).toBeNull();
    expect(loadWizardDraft()).toBeNull();
  });

  it("persists and clears the cover form draft", () => {
    expect(saveFormDraft({ name: "My game", description: "A game", selectedTags: ["Action"] })).toBe(true);
    const restored = loadFormDraft();
    expect(restored?.name).toBe("My game");
    expect(restored?.selectedTags).toEqual(["Action"]);

    clearFormDraft();
    expect(window.localStorage.getItem(FORM_STORAGE_KEY)).toBeNull();
    expect(loadFormDraft()).toBeNull();
  });

  it("clears both drafts at once", () => {
    saveWizardDraft({ id: "", characters: [], maps: [], items: [] });
    saveFormDraft({ name: "n", description: "d", selectedTags: [] });
    clearGameDraft();
    expect(loadWizardDraft()).toBeNull();
    expect(loadFormDraft()).toBeNull();
  });

  it("survives corrupt storage without throwing", () => {
    window.localStorage.setItem(WIZARD_STORAGE_KEY, "{not json");
    expect(loadWizardDraft()).toBeNull();
  });
});

describe("nested game payload schema", () => {
  it("accepts a payload with no characters, maps or items", () => {
    const result = pushGamesRequestSchema.safeParse({
      idempotencyKey: KEY,
      id: KEY,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.characters).toEqual([]);
      expect(result.data.maps).toEqual([]);
      expect(result.data.items).toEqual([]);
    }
  });

  it("accepts an entry without an image", () => {
    const result = pushGamesRequestSchema.safeParse({
      idempotencyKey: KEY,
      id: KEY,
      characters: [{ id: "c1", name: "Gandalf", description: "A wizard", image: "" }],
      maps: [],
      items: [],
    });
    expect(result.success).toBe(true);
  });

  it("still rejects an entry with no name", () => {
    const result = pushGamesRequestSchema.safeParse({
      idempotencyKey: KEY,
      id: KEY,
      characters: [{ id: "c1", description: "no name", image: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("defaults the collections on the convert-route schema", () => {
    const result = gameNestedDataSchema.safeParse({ id: KEY });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.characters).toEqual([]);
      expect(result.data.maps).toEqual([]);
      expect(result.data.items).toEqual([]);
    }
  });
});
