import { classifyError } from '@/utilities/errorHandler';
import type {
  AiQueuePushResponse,
  AiQueuePopResponse,
  AiQueueLengthResponse,
  AiDelayedPushResponse,
  AiDelayedPopResponse,
  AiOkResponse,
  AiGameState,
  AiOutput,
  AiOutputCountResponse,
  AiLockResult,
  AiReleaseResult,
  AiCounterResponse,
  AiHealthResponse,
  AiRagStagingItem,
  AiStoredChunk,
  AiDbsizeResponse,
} from '@/types/ai-server';

const AI_SERVER_BASE = process.env.AI_SERVER_URL ?? 'http://127.0.0.1:8000';
const REQUEST_TIMEOUT = 15_000;

class AiServerError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: string,
  ) {
    super(message);
    this.name = 'AiServerError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const url = `${AI_SERVER_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      let detail: string | undefined;
      try {
        const errBody = await res.json();
        detail = errBody.detail;
      } catch {}
      throw new AiServerError(
        `AI server returned ${res.status}`,
        res.status,
        detail,
      );
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof AiServerError) throw error;
    const classified = classifyError(error, `AiServerClient.${path}`);
    throw new AiServerError(classified.message);
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}

export const aiServer = {
  health: (): Promise<AiHealthResponse> => request('/health'),

  queue: {
    push: (uuid: string, data: Record<string, unknown>): Promise<AiQueuePushResponse> =>
      request(buildUrl('/queue/push', { uuid }), {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    pushUrlEncoded: (uuid: string, data: string): Promise<AiQueuePushResponse> => {
      const url = `${AI_SERVER_BASE}/queue/push?uuid=${encodeURIComponent(uuid)}&data=${encodeURIComponent(data)}`;
      return fetch(url, { method: 'POST' }).then(r => r.json());
    },

    pop: (): Promise<AiQueuePopResponse> => request('/queue/pop'),

    length: (): Promise<AiQueueLengthResponse> => request('/queue/length'),

    delayed: {
      push: (uuid: string, retryCount: number, score: number): Promise<AiDelayedPushResponse> =>
        request(buildUrl('/queue/delayed/push', { score }), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuid, retry_count: retryCount }),
        }),

      pop: (maxScore: number): Promise<AiDelayedPopResponse> =>
        request(buildUrl('/queue/delayed/pop', { max_score: maxScore })),
    },

    dead: {
      push: (uuid: string, error: string): Promise<AiOkResponse> =>
        request('/queue/dead/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuid, error }),
        }),
    },
  },

  games: {
    state: {
      get: (uuid: string): Promise<AiGameState> =>
        request(`/games/${uuid}/state`),

      getField: <T = unknown>(uuid: string, field: string): Promise<T> =>
        request(`/games/${uuid}/state/${field}`),

      set: (uuid: string, field: string, value: unknown): Promise<AiOkResponse> =>
        request(buildUrl(`/games/${uuid}/state/${field}`, { value: JSON.stringify(value) }), {
          method: 'PUT',
        }),

      delete: (uuid: string, field: string): Promise<AiOkResponse> =>
        request(`/games/${uuid}/state/${field}`, { method: 'DELETE' }),
    },

    counter: {
      incr: (uuid: string): Promise<AiCounterResponse> =>
        request(`/games/${uuid}/counter/incr`, { method: 'POST' }),

      set: (uuid: string, value: number): Promise<AiOkResponse> =>
        request(buildUrl(`/games/${uuid}/counter`, { value }), { method: 'PUT' }),
    },

    lock: {
      acquire: (uuid: string, workerId: string, ttl = 30): Promise<AiLockResult> =>
        request(buildUrl(`/games/${uuid}/lock`, { worker_id: workerId, ttl })),

      release: (uuid: string, workerId: string): Promise<AiReleaseResult> =>
        request(buildUrl(`/games/${uuid}/lock`, { worker_id: workerId }), { method: 'DELETE' }),
    },

    expire: (uuid: string, ttl: number): Promise<AiOkResponse> =>
      request(`/games/${uuid}/expire?ttl=${ttl}`, { method: 'POST' }),
  },

  rag: {
    staging: {
      push: (item: AiRagStagingItem): Promise<AiOkResponse> =>
        request('/rag/staging/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        }),

      pop: (): Promise<{ ok: boolean; item: AiRagStagingItem | null }> =>
        request('/rag/staging/pop'),

      count: (): Promise<{ count: number }> => request('/rag/staging/count'),
    },

    chunk: {
      get: (uuid: string, index: number): Promise<AiStoredChunk> =>
        request(`/rag/chunk/${uuid}/${index}`),
    },
  },

  output: {
    get: (uuid: string): Promise<AiOutput> => request(`/output/${uuid}`),

    set: (uuid: string, data: Record<string, unknown>): Promise<AiOkResponse> =>
      request(`/output/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    count: (): Promise<AiOutputCountResponse> => request('/output/count'),
  },

  admin: {
    keys: (pattern?: string, prefix?: string): Promise<string[]> =>
      request(buildUrl('/keys', { pattern, prefix })),

    dbsize: (prefix?: string): Promise<AiDbsizeResponse> =>
      request(buildUrl('/dbsize', { prefix })),

    deleteKey: (key: string, prefix: string): Promise<AiOkResponse> =>
      request(`/keys/${key}?prefix=${prefix}`, { method: 'DELETE' }),
  },
};
