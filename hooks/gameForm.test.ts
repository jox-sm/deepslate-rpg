import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGamesForm, createEmptyCharacter } from "./gameForm";

describe("useGamesForm", () => {
  it("walks the wizard and edits entries", () => {
    const { result } = renderHook(() => useGamesForm());
    expect(result.current.stepKey).toBe("characters");
    expect(result.current.isFirstStep).toBe(true);

    act(() => result.current.addCharacter());
    expect(result.current.formData.characters).toHaveLength(1);
    const id = result.current.formData.characters[0].id;
    act(() => result.current.updateCharacter(id, "name", "Mira"));
    expect(result.current.formData.characters[0].name).toBe("Mira");

    act(() => result.current.nextStep());
    expect(result.current.stepKey).toBe("maps");
    act(() => result.current.addMap());
    act(() => result.current.nextStep());
    expect(result.current.isLastStep).toBe(true);
    act(() => result.current.addItem());
    expect(result.current.formData.items).toHaveLength(1);

    act(() => result.current.removeCharacter(id));
    expect(result.current.formData.characters).toHaveLength(0);

    act(() => result.current.prevStep());
    expect(result.current.stepKey).toBe("maps");
  });

  it("clamps steps and resets", () => {
    const { result } = renderHook(() => useGamesForm());
    act(() => result.current.addCharacter());
    act(() => result.current.setStep(99));
    expect(result.current.isLastStep).toBe(true);
    act(() => result.current.reset());
    expect(result.current.stepKey).toBe("characters");
    expect(result.current.formData.characters).toHaveLength(0);
  });

  it("creates empty entries with ids", () => {
    expect(createEmptyCharacter().id).toBeTruthy();
  });
});
