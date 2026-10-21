import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdempotentRequest } from "./useIdempotentRequest";

beforeEach(() => {
  vi.restoreAllMocks();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload } as Response;
}

describe("useIdempotentRequest", () => {
  it("sends the idempotency key and returns data", async () => {
    const fetchMock = vi.fn(async () => okJson({ url: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIdempotentRequest());
    let out: unknown;
    await act(async () => {
      out = await result.current.sendRequest("/api/convertUrl", { a: 1 }, { idempotencyKey: "k1" });
    });
    expect(out).toEqual({ url: "x" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.idempotencyKey).toBe("k1");
    vi.unstubAllGlobals();
  });

  it("retries once with the same key after an abort", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortErr)
      .mockResolvedValueOnce(okJson({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIdempotentRequest());
    await act(async () => {
      await result.current.sendRequest("/api/push", {}, { idempotencyKey: "retry-key" });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map((c) =>
      JSON.parse((c[1] as RequestInit).body as string).idempotencyKey
    );
    expect(keys).toEqual(["retry-key", "retry-key"]);
    vi.unstubAllGlobals();
  });

  it("throws after the retry is exhausted", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn(async () => { throw abortErr; }));
    const { result } = renderHook(() => useIdempotentRequest());
    await act(async () => {
      await expect(
        result.current.sendRequest("/api/push", {}, { idempotencyKey: "k" })
      ).rejects.toThrow("Request aborted");
    });
    vi.unstubAllGlobals();
  });

  it("tracks and aborts active requests", async () => {
    const fetchMock = vi.fn(
      () => new Promise<Response>(() => {})
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIdempotentRequest());
    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.sendRequest("/api/push", {}, { idempotencyKey: "tracked" });
      void pending.catch(() => {});
    });
    expect(result.current.getActiveRequests()).toContain("tracked");
    act(() => {
      result.current.abortAll();
    });
    expect(result.current.getActiveRequests()).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
