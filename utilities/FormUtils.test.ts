import { describe, it, expect } from "vitest";
import { validateText } from "./FormUtils";

const opts = { minLength: 4, maxLength: 20, fieldName: "Name" };

describe("validateText", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(validateText("", opts)).toMatchObject({ isFormValid: false, errorColor: "warning" });
    expect(validateText("    ", opts)).toMatchObject({
      isFormValid: false,
      errorMessage: expect.stringContaining("whitespace"),
    });
  });

  it("enforces min and max length on trimmed text", () => {
    expect(validateText("abc", opts).isFormValid).toBe(false);
    const over = validateText("a".repeat(21), opts);
    expect(over).toMatchObject({ isFormValid: false, errorColor: "error" });
    expect(validateText("abcd", opts)).toMatchObject({ isFormValid: true, errorMessage: "OK" });
  });

  it("reports non-space trueLength", () => {
    expect(validateText("a b c d", opts).trueLength).toBe(4);
  });

  it("rejects weird character runs", () => {
    expect(validateText("aaaaaaabcd", opts).isFormValid).toBe(false);
    expect(validateText("hello..world", opts).isFormValid).toBe(false);
  });

  it("rejects SQL injection patterns", () => {
    expect(validateText("DROP TABLE games", opts)).toMatchObject({
      isFormValid: false,
      errorMessage: expect.stringContaining("unsafe"),
    });
    expect(validateText("1 OR 1=1", opts).isFormValid).toBe(false);
  });

  it("accepts clean in-range text", () => {
    const r = validateText("The Sunken Vault", opts);
    expect(r).toMatchObject({ isFormValid: true, errorColor: "success" });
  });
});
