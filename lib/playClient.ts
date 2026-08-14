import type {
  AiMemoryChunk,
  AiMemoryExportResponse,
  AiOkResponse,
  AiOutput,
  AiQueuePushResponse,
} from "@/types/ai-server";

// Client helpers for the full play flow. Everything goes through Next.js
// server routes (CORS-free), so the browser never talks to the AI server.

const AI = "/api/ai-server";
const MEM = (sid: string) => `/api/games/${sid}/memory`;

async function json<T>(res: Promise<Response> | Response): Promise<T> {
  const r = await res;
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(detail || `Request failed (${r.status})`);
  }
  return (await r.json()) as T;
}

export function queuePush(sid: string, data: Record<string, unknown>): Promise<AiQueuePushResponse> {
  const qs = new URLSearchParams();
  qs.set("uuid", sid);
  qs.set("data", JSON.stringify(data));
  return json<AiQueuePushResponse>(fetch(`${AI}/queue/push?${qs.toString()}`, { method: "POST" }));
}

export function outputGet(sid: string): Promise<AiOutput | null> {
  return fetch(`${AI}/output/${sid}`).then((res) =>
    res.status === 404 ? null : json<AiOutput>(Promise.resolve(res)),
  );
}

export function outputCount(): Promise<{ count: number }> {
  return json<{ count: number }>(fetch(`${AI}/output/count`));
}

export function queueLength(): Promise<{ length: number }> {
  return json<{ length: number }>(fetch(`${AI}/queue/length`));
}

export function stateSetField(sid: string, field: string, value: unknown): Promise<AiOkResponse> {
  const qs = new URLSearchParams({ value: JSON.stringify(value) });
  return json<AiOkResponse>(fetch(`${AI}/games/${sid}/state/${field}?${qs.toString()}`, { method: "PUT" }));
}

export function counterIncr(sid: string): Promise<{ counter: number }> {
  return json<{ counter: number }>(fetch(`${AI}/games/${sid}/counter/incr`, { method: "POST" }));
}

export async function memoryExport(sid: string): Promise<AiMemoryExportResponse> {
  return json<AiMemoryExportResponse>(fetch(`${MEM(sid)}`));
}

export async function memoryRestore(sid: string, chunks: AiMemoryChunk[]): Promise<AiOkResponse> {
  return json<AiOkResponse>(
    fetch(`${MEM(sid)}`, { method: "POST", body: JSON.stringify({ chunks }) }),
  );
}

export async function memoryClear(sid: string): Promise<AiOkResponse> {
  return json<AiOkResponse>(fetch(`${MEM(sid)}`, { method: "DELETE" }));
}