import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  queuePush,
  outputGet,
  stateSetField,
  counterIncr,
  memoryExport,
  memoryRestore,
  memoryClear,
} from "./playClient";

beforeEach(() => {
  vi.restoreAllMocks();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload, text: async () => "" } as Response;
}

describe("playClient", () => {
  it("posts queue pushes with uuid + data params", async () => {
    const fetchMock = vi.fn(async () => okJson({ queued: true }));
    vi.stubGlobal("fetch", fetchMock);
    await queuePush("sid1", { prompt: "go north" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/ai-server/queue/push");
    expect(url).toContain("uuid=sid1");
    expect((init as RequestInit).method).toBe("POST");
    vi.unstubAllGlobals();
  });

  it("returns null on 404 output, story otherwise", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 404 }) as Response));
    expect(await outputGet("s")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ story: "tale" })));
    expect(await outputGet("s")).toEqual({ story: "tale" });
    vi.unstubAllGlobals();
  });

  it("throws with server detail on errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, text: async () => "boom" }) as Response)
    );
    await expect(stateSetField("s", "f", 1)).rejects.toThrow("boom");
    vi.unstubAllGlobals();
  });

  it("hits counter, memory export/restore/clear endpoints", async () => {
    const fetchMock = vi.fn(async () => okJson({}));
    vi.stubGlobal("fetch", fetchMock);
    await counterIncr("s");
    await memoryExport("s");
    await memoryRestore("s", []);
    await memoryClear("s");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("counter/incr"))).toBe(true);
    expect(urls.filter((u) => u.includes("/memory"))).toHaveLength(3);
    vi.unstubAllGlobals();
  });
});
