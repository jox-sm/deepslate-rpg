import { NextRequest, NextResponse } from "next/server";
import { tryApiRoute } from "@/utilities/apiErrorHandler";
import { retry } from "@/lib/retry";
import { tryOrErrorSync } from "@/utilities/errorHandler";

// Server-only proxy to the AI server's /memory/* endpoints (Upstash Search).
// The web app never talks to Upstash directly — creds stay on the AI server.
// Endpoints mirror REDIS_API.md → "Game Memory (Upstash Search)".

const AI_SERVER_URL = process.env.AI_SERVER_URL ?? "http://127.0.0.1:8000";

async function proxy(request: NextRequest, sid: string, method: string) {
  const path =
    method === "GET"
      ? `/memory/export/${encodeURIComponent(sid)}`
      : method === "DELETE"
        ? `/memory/clear?namespace=${encodeURIComponent(sid)}`
        : "/memory/restore";

  const init: RequestInit = { method, headers: {} };
  if (method === "POST") {
    init.headers = { "Content-Type": "application/json" };
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.chunks)) {
      return NextResponse.json({ error: "Missing chunks array" }, { status: 400 });
    }
    init.body = JSON.stringify({ namespace: sid, chunks: body.chunks });
  }

  const res = await retry(() => fetch(`${AI_SERVER_URL}${path}`, init), 3, 500);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `AI server returned ${res.status}`);
  }
  const parsed = tryOrErrorSync(() => (text ? JSON.parse(text) : { ok: true }), {
    context: "games.memory.proxy.parse",
    suppressToast: true,
    suppressComponent: true,
  });
  if (!parsed.ok) {
    throw new Error(parsed.error?.message || "Invalid response from AI server");
  }
  return NextResponse.json(parsed.data);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  return (await tryApiRoute(() => proxy(_req, id, "GET"), "games.memory.GET")) as NextResponse;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  return (await tryApiRoute(() => proxy(req, id, "POST"), "games.memory.POST")) as NextResponse;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  return (await tryApiRoute(() => proxy(_req, id, "DELETE"), "games.memory.DELETE")) as NextResponse;
}