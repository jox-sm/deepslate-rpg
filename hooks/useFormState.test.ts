import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormState } from "./useFormState";

describe("useFormState", () => {
  it("updates fields and resets", () => {
    const { result } = renderHook(() => useFormState({ name: "", count: 0 }));
    act(() => result.current.updateField("name", "Vault"));
    expect(result.current.state.name).toBe("Vault");
    act(() => result.current.setLoading(true));
    expect(result.current.loading).toBe(true);
    act(() => result.current.reset());
    expect(result.current.state).toEqual({ name: "", count: 0 });
  });
});
