import { NextRequest, NextResponse } from "next/server";

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

  const res = await fetch(`${AI_SERVER_URL}${path}`, init);
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: text }, { status: 502 });
  }
  return NextResponse.json(text ? JSON.parse(text) : { ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    return await proxy(_req, id, "GET");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    return await proxy(req, id, "POST");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    return await proxy(_req, id, "DELETE");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clear failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}