/**
 * Batch Game Fetch Pipeline
 *
 * Collects fetch requests into a queue and processes them in batches
 * to minimize database round trips. Uses Redis queue for async processing.
 *
 * Compatibility barrel — implementations live in ./gameFetch/. All seven
 * public exports stay importable from this original path.
 */

export { queueGameFetch, getQueueStats, clearQueue } from './gameFetch/enqueue';
export { processBatch } from './gameFetch/processor';
export { getFetchResult, waitForFetchResult, getGameWithBatchQueue } from './gameFetch/results';
