import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as convertUrl } from "./route";

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

vi.mock("@/lib/storage", () => ({
  uploadImage: vi.fn(async () => "https://cdn/x.webp"),
}));

function req(body: unknown) {
  return new NextRequest("http://test/api/convertUrl", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/convertUrl", () => {
  it("requires idempotencyKey and image", async () => {
    expect((await convertUrl(req({}))).status).toBe(400);
    expect((await convertUrl(req({ idempotencyKey: "k" }))).status).toBe(400);
  });

  it("uploads and returns the URL", async () => {
    const image = Buffer.from("img").toString("base64");
    const res = await convertUrl(req({ idempotencyKey: "k", image }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toBe("https://cdn/x.webp");
  });
});
