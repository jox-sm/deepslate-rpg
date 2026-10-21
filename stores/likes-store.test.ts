import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLikesStore } from "./likes-store";

vi.mock("@/ui/notifications", () => ({
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

function ok() {
  return { ok: true } as Response;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useLikesStore.setState({ likedGameIds: new Set(), likeCounts: {}, pendingLikes: new Set() });
});

async function flush() {
  await actAsync();
}

function actAsync() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("likes store", () => {
  it("optimistically adds a like and applies on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    const { toggleLike, isLiked } = useLikesStore.getState();
    toggleLike("g1", 5);
    expect(isLiked("g1")).toBe(true);
    await flush();
    const s = useLikesStore.getState();
    expect(s.pendingLikes.has("g1")).toBe(false);
    // Optimistic add increments from the store's own baseline (0), not the
    // passed currentCount — currentCount is only the revert baseline.
    expect(s.getLikeCount("g1")).toBe(1);
    vi.unstubAllGlobals();
  });

  it("reverts on server failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    useLikesStore.getState().toggleLike("g2", 5);
    await flush();
    const s = useLikesStore.getState();
    expect(s.isLiked("g2")).toBe(false);
    expect(s.getLikeCount("g2")).toBe(5);
    vi.unstubAllGlobals();
  });

  it("ignores duplicate toggles while pending", async () => {
    let resolveFetch!: (v: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { resolveFetch = r; }));
    vi.stubGlobal("fetch", fetchMock);
    const api = useLikesStore.getState();
    api.toggleLike("g3", 1);
    api.toggleLike("g3", 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(ok());
    await flush();
    vi.unstubAllGlobals();
  });

  it("seeds initial liked ids", () => {
    useLikesStore.getState().setInitialLiked(["a", "b"]);
    expect(useLikesStore.getState().isLiked("a")).toBe(true);
  });
});
