import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as convertGameImages } from "./route";

vi.mock("@/lib/jwt-validate", () => ({
  validateJWTMiddleware: vi.fn(async () => ({ payload: { userId: "u1" }, error: null })),
}));

vi.mock("@/utilities/idempotency", () => ({
  withIdempotency: async (_key: string, fn: () => Promise<unknown>) => ({
    result: await fn(),
    cached: false,
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ getToken: async () => "token" })),
}));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedSupabaseClient: vi.fn(async () => ({})),
}));

// Storage is unreachable in this environment - the upload must fail without
// taking the whole request down.
vi.mock("@/lib/storage", () => ({
  uploadImage: vi.fn(async () => {
    throw new Error("storage unreachable");
  }),
}));

const KEY = "019e370f-0173-703c-b4e1-bb027a921947";

function req(body: unknown) {
  return new NextRequest("http://test/api/convertUrl/ConvertGameImages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/convertUrl/ConvertGameImages", () => {
  it("requires an idempotency key", async () => {
    expect((await convertGameImages(req({ id: KEY }))).status).toBe(400);
  });

  it("accepts a game with no characters, maps or items at all", async () => {
    const res = await convertGameImages(req({ idempotencyKey: KEY, id: KEY }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.characters).toEqual([]);
    expect(json.maps).toEqual([]);
    expect(json.items).toEqual([]);
  });

  it("keeps entries that have no image, with an empty image", async () => {
    const res = await convertGameImages(
      req({
        idempotencyKey: KEY,
        id: KEY,
        characters: [{ id: "c1", name: "Gandalf", description: "A wizard", image: "" }],
        maps: [],
        items: [],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // The entry SURVIVES even though it has no image.
    expect(json.characters).toHaveLength(1);
    expect(json.characters[0].name).toBe("Gandalf");
    expect(json.characters[0].image).toBe("");
  });

  it("keeps entries whose image upload fails", async () => {
    const res = await convertGameImages(
      req({
        idempotencyKey: KEY,
        id: KEY,
        characters: [{ id: "c1", name: "Gandalf", description: "A wizard", image: "aGk=" }],
        maps: [],
        items: [],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.characters).toHaveLength(1);
    expect(json.characters[0].image).toBe("");
  });

  it("rejects an entry with no name", async () => {
    const res = await convertGameImages(
      req({
        idempotencyKey: KEY,
        id: KEY,
        characters: [{ id: "c1", description: "no name", image: "" }],
      })
    );
    expect(res.status).toBe(400);
  });
});
