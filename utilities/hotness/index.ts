// Internal barrel for the hotness cache implementation.
export { checkMemoryPressure, getHotness, incrementHotness } from './hotness';
export { compressData, decompressData } from './compression';
export { cacheHit } from './hit';
export { cacheMiss } from './miss';
export { getCachedGameData, getCacheStats, clearCache } from './queries';
