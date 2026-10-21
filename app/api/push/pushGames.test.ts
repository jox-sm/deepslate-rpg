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
vi.mock("@/lib/GamesInsert", () => ({ processGamesQueue: vi.fn(async () => ({ ok: 1 })) }));
vi.mock("@/utilities/pull", () => ({ drainGames: vi.fn(async () => ({ ok: 1 })) }));

function req(body: unknown) {
  return new NextRequest("http://test/api/push/pushGames", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/push/pushGames", () => {
  it("rejects requests without an idempotency key", async () => {
    const res = await pushGames(req({ data: {} }));
    expect(res.status).toBe(400);
  });

  it("pushes game data and syncs both databases", async () => {
    const res = await pushGames(req({ idempotencyKey: "k1", characters: [], maps: [], items: [] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("rejects unauthenticated callers", async () => {
    const { validateJWTMiddleware } = await import("@/lib/jwt-validate");
    vi.mocked(validateJWTMiddleware).mockResolvedValueOnce({ payload: null, error: new Response("no", { status: 401 }) } as never);
    const res = await pushGames(req({ idempotencyKey: "k2" }));
    expect(res.status).toBe(401);
  });
});
