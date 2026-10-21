import { NextRequest, NextResponse } from "next/server";
import { tryApiRoute } from "@/utilities/apiErrorHandler";
import { retry } from "@/lib/retry";
import { tryOrErrorSync, classifyError } from "@/utilities/errorHandler";

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

  const res = await retry(() => fetch(target, init), 3, 500);
  const text = await res.text();
  if (!res.ok) {
    const parsed = tryOrErrorSync(() => (text ? JSON.parse(text) : null), {
      context: "ai-server.relay.parseError",
      suppressToast: true,
      suppressComponent: true,
    });
    const detail =
      parsed.ok && parsed.data && typeof parsed.data === "object" && "detail" in (parsed.data as object)
        ? String((parsed.data as { detail: unknown }).detail)
        : text;
    throw new Error(detail || `AI server returned ${res.status}`);
  }
  const parsed = tryOrErrorSync(() => (text ? JSON.parse(text) : { ok: true }), {
    context: "ai-server.relay.parse",
    suppressToast: true,
    suppressComponent: true,
  });
  if (!parsed.ok) {
    const classified = classifyError(parsed.error, "ai-server.relay.parse");
    throw new Error(classified.message);
  }
  return NextResponse.json(parsed.data);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  return (await tryApiRoute(
    () => relay(req, path.join("/"), "GET"),
    "ai-server.GET"
  )) as NextResponse;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  return (await tryApiRoute(
    () => relay(req, path.join("/"), "POST"),
    "ai-server.POST"
  )) as NextResponse;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  return (await tryApiRoute(
    () => relay(req, path.join("/"), "PUT"),
    "ai-server.PUT"
  )) as NextResponse;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await params;
  return (await tryApiRoute(
    () => relay(req, path.join("/"), "DELETE"),
    "ai-server.DELETE"
  )) as NextResponse;
}