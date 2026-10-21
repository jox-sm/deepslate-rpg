import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as push } from "./route";

vi.mock("@/lib/jwt-validate", () => ({
  validateJWTMiddleware: vi.fn(async () => ({ payload: { userId: "u1" }, error: null })),
}));

vi.mock("@/lib/middleware/rate-limit", () => ({
  rateLimitMiddleware: vi.fn(async () => {}),
}));

vi.mock("@/utilities/idempotency", () => ({
  withIdempotency: async (_key: string, fn: () => Promise<unknown>) => ({
    result: await fn(),
    cached: false,
  }),
}));

vi.mock("@/utilities/queue", () => ({ enqueue: vi.fn(async () => {}) }));
vi.mock("@/lib/queue", () => ({ redis: { incrby: vi.fn(async () => 1) } }));

function req(body: unknown) {
  return new NextRequest("http://test/api/push", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/push", () => {
  it("rejects invalid bodies", async () => {
    const res = await push(req({ nope: true }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown types at the schema gate", async () => {
    const res = await push(req({ idempotencyKey: crypto.randomUUID(), type: "dragon", data: {} }));
    expect(res.status).toBe(400);
  });

  it("registers likes", async () => {
    const res = await push(
      req({ idempotencyKey: crypto.randomUUID(), type: "like", data: { id: crypto.randomUUID(), likesDelta: 1 } })
    );
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Like registered");
  });
});
