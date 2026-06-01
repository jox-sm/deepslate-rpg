// types/api.ts

// Idempotency types
export interface IdempotentRequest {
  idempotencyKey: string; // UUID v7
  [key: string]: unknown;
}

export interface IdempotentResponse {
  success: boolean;
  idempotencyKey: string;
  data?: unknown;
  error?: string;
  cached?: boolean;
}

export interface IdempotencyError {
  type: 'duplicate_request' | 'request_failed' | 'timeout';
  message: string;
  idempotencyKey: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  idempotencyKey?: string;
  cached?: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    source: string;
  };
}

// Request status types
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'aborted';

export interface RequestState {
  status: RequestStatus;
  idempotencyKey?: string;
  error?: string;
  retryCount: number;
}

// Abort controller types
export interface AbortableRequest {
  idempotencyKey: string;
  controller: AbortController;
  timeout?: ReturnType<typeof setTimeout>;
}

export interface RequestManager {
  activeRequests: Map<string, AbortableRequest>;
  addRequest: (key: string, controller: AbortController) => void;
  removeRequest: (key: string) => void;
  abortRequest: (key: string) => boolean;
  abortAll: () => void;
}

// Timeout configuration
export const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
export const IDEMPOTENCY_TTL_SECONDS = 300; // 5 minutes