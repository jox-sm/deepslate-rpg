/**
 * Shared constants and types for the batch game fetch pipeline.
 *
 * These were module-private in the original single-file pipeline. They are
 * exported here only so sibling modules can share the same (single) objects;
 * they are intentionally NOT re-exported from the public barrel, preserving
 * the original module's public surface.
 */

export const QUEUE_KEYS = {
  FETCH_QUEUE: 'game:fetch:queue',
  REQUEST_RESULTS: 'game:fetch:results:',
};

export const BATCH_SIZE = 20; // Process 20 games per batch
export const BATCH_TIMEOUT_MS = 200; // Wait up to 200ms for a full batch

export interface FetchRequest {
  requestId: string;
  uuid: string;
}

export interface FullGameData {
  id: string;
  name: string;
  description: string;
  image?: string;
  tags?: string[];
  likes_count?: number;
  created_at?: string;
  updated_at?: string;
  characters: unknown[];
  maps: unknown[];
  items: unknown[];
  status: string;
}
