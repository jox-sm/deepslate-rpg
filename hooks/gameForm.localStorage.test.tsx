import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useGamesForm } from "@/hooks/gameForm";
import { bufferToDataUrl } from "@/utilities/clientUtilities/imagesUtils";
import { WIZARD_STORAGE_KEY } from "@/utilities/clientUtilities/gameDraftStorage";

/**
 * Exercises the REAL useGamesForm hook against the REAL localStorage.
 * Proves the wizard actually writes the draft to localStorage and reads it
 * back when it mounts again.
 */
function WizardHarness({ onReady }: { onReady?: (api: ReturnType<typeof useGamesForm>) => void }) {
  const api = useGamesForm();
  if (onReady) onReady(api);
  return (
    <div>
      <span data-testid="count">{api.formData.characters.length}</span>
      <span data-testid="name">{api.formData.characters[0]?.name ?? ""}</span>
      <span data-testid="has-image">{api.formData.characters[0]?.image ? "yes" : "no"}</span>
    </div>
  );
}

describe("useGamesForm <-> localStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("writes the wizard draft to localStorage and restores it on remount", async () => {
    const image = new Uint8Array([1, 2, 3, 4]).buffer;
    const dataUrl = bufferToDataUrl(image, "image/png");

    // --- first mount: add a character with an image -----------------------
    let api!: ReturnType<typeof useGamesForm>;
    const first = render(<WizardHarness onReady={(a) => (api = a)} />);

    await act(async () => {
      api.addCharacter();
    });
    const characterId = api.formData.characters[0].id;

    // All four updates land in the SAME React batch - this is exactly what
    // ImageUpload does when a file is chosen (onSelect + onPreviewChange).
    await act(async () => {
      api.updateCharacter(characterId, "name", "Gandalf");
      api.updateCharacter(characterId, "description", "A wizard");
      api.updateCharacter(characterId, "image", image);
      api.updateCharacter(characterId, "imagePreview", dataUrl);
    });

    // Every field must survive the batch.
    expect(api.formData.characters[0].name).toBe("Gandalf");
    expect(api.formData.characters[0].description).toBe("A wizard");
    expect(api.formData.characters[0].image).not.toBeNull();
    expect(api.formData.characters[0].imagePreview).toBe(dataUrl);

    // --- the draft must be in localStorage -------------------------------
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.characters[0].name).toBe("Gandalf");
    expect(parsed.characters[0].description).toBe("A wizard");
    // The image is stored as a data URL (persistable), not a blob URL.
    expect(parsed.characters[0].image).toBe(dataUrl);
    expect(parsed.characters[0].image).not.toContain("blob:");

    // --- remount: the draft must come back -------------------------------
    first.unmount();
    render(<WizardHarness />);

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("name")).toHaveTextContent("Gandalf");
    expect(screen.getByTestId("has-image")).toHaveTextContent("yes");
  });

  it("removes the localStorage entry once the draft is empty again", async () => {
    let api!: ReturnType<typeof useGamesForm>;
    render(<WizardHarness onReady={(a) => (api = a)} />);

    await act(async () => {
      api.addCharacter();
    });
    expect(window.localStorage.getItem(WIZARD_STORAGE_KEY)).not.toBeNull();

    await act(async () => {
      api.reset();
    });

    // An empty draft is removed rather than written back.
    expect(window.localStorage.getItem(WIZARD_STORAGE_KEY)).toBeNull();
  });
});
