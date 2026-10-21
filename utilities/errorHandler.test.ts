import { describe, it, expect } from "vitest";
import {
  classifyError,
  tryOrError,
  tryOrErrorSync,
  isNotFound,
  isRetryable,
  getErrorMessage,
} from "./errorHandler";

describe("classifyError", () => {
  it("maps HTTP statuses to categories", () => {
    expect(classifyError({ status: 404 }, "t").category).toBe("not-found");
    expect(classifyError({ status: 401 }, "t").category).toBe("auth");
    expect(classifyError({ status: 429 }, "t").category).toBe("timeout");
  });

  it("detects network failures", () => {
    expect(classifyError(new TypeError("fetch failed"), "t").category).toBe("network");
  });

  it("falls back to unknown for opaque values", () => {
    expect(classifyError("boom", "t").category).toBe("unknown");
  });
});

describe("tryOrError helpers", () => {
  it("captures sync success and failure", () => {
    expect(tryOrErrorSync(() => 42, { context: "t" })).toMatchObject({ ok: true, data: 42 });
    const failed = tryOrErrorSync(() => { throw new Error("nope"); }, { context: "t" });
    expect(failed.ok).toBe(false);
  });

  it("captures async results", async () => {
    const ok = await tryOrError(async () => "yes", { context: "t" });
    expect(ok).toMatchObject({ ok: true, data: "yes" });
  });

  it("classifies helper predicates", () => {
    const notFound = { ok: false as const, error: { category: "not-found" } };
    expect(isNotFound(notFound as never)).toBe(true);
    expect(
      isRetryable({ ok: false as const, error: { category: "network", retryable: true } } as never)
    ).toBe(true);
    expect(isRetryable({ ok: false as const, error: { category: "network" } } as never)).toBe(false);
    expect(getErrorMessage({ ok: false as const, error: new Error("x") } as never)).toBe("x");
  });
});
