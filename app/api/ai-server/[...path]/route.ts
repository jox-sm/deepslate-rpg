import { NextRequest, NextResponse } from "next/server";

// Server-only relay to the AI server (FastAPI on 127.0.0.1:8000).
// The browser never talks to the AI server directly (no CORS middleware there).

const AI_SERVER_URL = process.env.AI_SERVER_URL ?? "http://127.0.0.1:8000";

async function relay(req: NextRequest, path: string, method: string): Promise<NextResponse> {
  const qs = req.nextUrl.searchParams.toString();
  const target = `${AI_SERVER_URL}/${path}${qs ? `?${qs}` : ""}`;

  const init: RequestInit = { method, headers: {} };
  if (method === "POST" || method === "PUT") {
    init.headers = { "Content-Type": "application/json" };
    init.body = await req.text().catch(() => "");
  }

  const res = await fetch(target, init);
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: text || `AI server returned ${res.status}` },
      { status: 502 },
    );
  }
  return NextResponse.json(text ? JSON.parse(text) : { ok: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  try {
    return await relay(req, path.join("/"), "GET");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Relay failed" },
      { status: 502 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  try {
    return await relay(req, path.join("/"), "POST");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Relay failed" },
      { status: 502 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  try {
    return await relay(req, path.join("/"), "PUT");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Relay failed" },
      { status: 502 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  try {
    return await relay(req, path.join("/"), "DELETE");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Relay failed" },
      { status: 502 },
    );
  }
}