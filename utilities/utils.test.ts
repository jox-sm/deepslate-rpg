import { describe, it, expect, vi, beforeEach } from "vitest";
import { prepareGameCard, prepareGameCards, fetchGamesFromApi } from "./utils";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("prepareGameCard(s)", () => {
  const base = {
    id: "",
    name: "Vault",
    description: "Deep halls",
    tags: ["dark"],
    image: "img",
    likes_count: 0,
  };

  it("stamps id and timestamps", () => {
    const card = prepareGameCard(base);
    expect(card.id).toBeTruthy();
    expect(card.created_at).toBeTruthy();
    expect(card.updated_at).toBe(card.created_at);
    expect(card.name).toBe("Vault");
  });

  it("maps arrays with unique ids", () => {
    const [a, b] = prepareGameCards([base, base]);
    expect(a.id).not.toBe(b.id);
  });
});

describe("fetchGamesFromApi", () => {
  it("maps offset to pages and returns data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: [{ id: "1" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const cards = await fetchGamesFromApi(6);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    expect(cards).toEqual([
      {
        id: "1",
        name: "Untitled",
        description: "",
        likes_count: 0,
        tags: [],
        image: "/images/project.jpg",
      },
    ]);
    vi.unstubAllGlobals();
  });

  it("throws on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await expect(fetchGamesFromApi(0)).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
