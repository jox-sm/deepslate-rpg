import { NextRequest, NextResponse } from "next/server";
import { tryApiRoute } from "@/utilities/apiErrorHandler";
import { retry } from "@/lib/retry";
import { tryOrErrorSync, classifyError } from "@/utilities/errorHandler";
import { validateJWTMiddleware } from "@/lib/jwt-validate";

// Server-only relay to the AI server (FastAPI on 127.0.0.1:8000).
// The browser never talks to the AI server directly (no CORS middleware there).
//
// Security posture:
// - Every handler requires a valid Clerk session (validateJWTMiddleware) — the
//   middleware chain restricts /api to signed-in users, and this re-checks it
//   server-side inside the relay itself.
// - Only the gameplay surface is forwardable (see isAllowed). Admin/destructive
//   endpoints (/keys, /dbsize, /delete/keys/*) and queue internals
//   (/queue/pop, /queue/delayed/*, /queue/dead/*) are NOT exposed.

const AI_SERVER_URL = process.env.AI_SERVER_URL ?? "http://127.0.0.1:8000";

// Exact path+method pairs the play flow needs. Pattern routes are checked in
// isAllowed (they carry the session id).
const EXACT_ALLOWED: Record<string, string[]> = {
  health: ["GET"],
  trigger: ["POST"], // advisory status probe; the engine consumes the queue itself
  "queue/push": ["POST"],
  "queue/length": ["GET"],
  "output/count": ["GET"],
};

function isAllowed(segments: string[], method: string): boolean {
  const exact = EXACT_ALLOWED[segments.join("/")];
  if (exact?.includes(method)) return true;
  // GET /output/{sid} — poll the story written by the engine.
  if (method === "GET" && segments.length === 2 && segments[0] === "output") return true;
  // GET/PUT /games/{sid}/state/{field} — per-field state read/write.
  if (
    segments.length === 4 &&
    segments[0] === "games" &&
    segments[2] === "state" &&
    (method === "GET" || method === "PUT")
  ) {
    return true;
  }
  // POST /games/{sid}/counter/incr — client-side turn counter.
  if (
    segments.length === 4 &&
    segments[0] === "games" &&
    segments[2] === "counter" &&
    segments[3] === "incr" &&
    method === "POST"
  ) {
    return true;
  }
  return false;
}

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

async function handler(
  req: NextRequest,
  path: string[],
  method: string,
): Promise<NextResponse> {
  const auth = await validateJWTMiddleware(req);
  if (auth.error) return auth.error;
  if (!isAllowed(path, method)) {
    return NextResponse.json(
      { success: false, error: `AI-server path not allowed: ${method} /${path.join("/")}` },
      { status: 403 },
    );
  }
  return (await tryApiRoute(
    () => relay(req, path.join("/"), method),
    `ai-server.${method}`
  )) as NextResponse;
}

function segments(params: Promise<{ path?: string[] }>): Promise<string[]> {
  return params.then(({ path = [] }) => path);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const path = await segments(params);
  return handler(req, path, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const path = await segments(params);
  return handler(req, path, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const path = await segments(params);
  return handler(req, path, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const path = await segments(params);
  return handler(req, path, "DELETE");
}
