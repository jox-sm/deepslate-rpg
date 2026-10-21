import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameForm } from "./form";
import { initialGameFormState } from "@/types/form";

describe("useGameForm", () => {
  it("updates fields and toggles the wizard", () => {
    const { result } = renderHook(() => useGameForm(initialGameFormState));
    act(() => result.current.updateField("name", "Vault"));
    expect(result.current.form.name).toBe("Vault");
    act(() => result.current.setShowWizard(true));
    expect(result.current.showWizard).toBe(true);
    act(() => result.current.resetForm());
    expect(result.current.form.name).toBe("");
    expect(result.current.showWizard).toBe(false);
  });
});
