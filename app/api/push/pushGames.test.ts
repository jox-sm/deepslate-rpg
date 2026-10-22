import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as pushGames } from "./pushGames/route";

vi.mock("@/lib/jwt-validate", () => ({
  validateJWTMiddleware: vi.fn(async () => ({ payload: { userId: "u1" }, error: null })),
}));

vi.mock("@/utilities/idempotency", () => ({
  withIdempotency: async (_key: string, fn: () => Promise<unknown>) => ({
    result: await fn(),
    cached: false,
  }),
}));

vi.mock("@/utilities/queue", () => ({ enqueue: vi.fn(async () => {}) }));
vi.mock("@/lib/GamesInsert", () => ({
  processGamesQueue: vi.fn(async () => ({ processed: 1, skipped: 0 })),
}));
vi.mock("@/utilities/pull", () => ({ drainGames: vi.fn(async () => ({ processed: 1 })) }));

const KEY = "019e370f-0173-703c-b4e1-bb027a921947";

function req(body: unknown) {
  return new NextRequest("http://test/api/push/pushGames", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: KEY,
    id: KEY,
    characters: [{ id: "c1", name: "Gandalf", description: "A wizard", image: "" }],
    maps: [{ id: "m1", nameOfPlace: "Rivendell", sizeOfPlace: "large", placesAtMap: "The garden", image: "" }],
    items: [{ id: "i1", name: "Staff", image: "" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/push/pushGames", () => {
  it("rejects requests without an idempotency key", async () => {
    const res = await pushGames(req({ data: {} }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-uuid idempotency key", async () => {
    const res = await pushGames(req(validBody({ idempotencyKey: "k1" })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.details.length).toBeGreaterThan(0);
  });

  it("rejects a payload without a game id", async () => {
    const body = validBody();
    delete (body as Partial<typeof body>).id;
    const res = await pushGames(req(body));
    expect(res.status).toBe(400);
  });

  it("rejects a character with no name", async () => {
    const res = await pushGames(
      req(validBody({ characters: [{ id: "c1", description: "no name", image: "" }] }))
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid game data");
    expect(json.details.some((d: { path: string[] }) => d.path.includes("characters"))).toBe(true);
  });

  it("rejects a map with no nameOfPlace", async () => {
    const res = await pushGames(
      req(validBody({ maps: [{ id: "m1", sizeOfPlace: "large", placesAtMap: "x", image: "" }] }))
    );
    expect(res.status).toBe(400);
  });

  it("rejects an item with no name", async () => {
    const res = await pushGames(req(validBody({ items: [{ id: "i1", image: "" }] })));
    expect(res.status).toBe(400);
  });

  it("pushes game data and syncs both databases", async () => {
    const res = await pushGames(req(validBody()));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("accepts empty nested collections", async () => {
    const res = await pushGames(
      req(validBody({ characters: [], maps: [], items: [] }))
    );
    expect(res.status).toBe(200);
  });

  it("accepts a payload with no nested collections at all", async () => {
    const res = await pushGames(req({ idempotencyKey: KEY, id: KEY }));
    expect(res.status).toBe(200);
  });

  it("normalises a null image to an empty string", async () => {
    const { enqueue } = await import("@/utilities/queue");
    const res = await pushGames(
      req(
        validBody({
          characters: [{ id: "c1", name: "Gandalf", description: "A wizard", image: null }],
        })
      )
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(enqueue).mock.calls[0][2]).toMatchObject({
      characters: [{ image: "" }],
    });
  });

  it("rejects unauthenticated callers", async () => {
    const { validateJWTMiddleware } = await import("@/lib/jwt-validate");
    vi.mocked(validateJWTMiddleware).mockResolvedValueOnce({
      payload: null,
      error: new Response("no", { status: 401 }),
    } as never);
    const res = await pushGames(req(validBody()));
    expect(res.status).toBe(401);
  });
});
