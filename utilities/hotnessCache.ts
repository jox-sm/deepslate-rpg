// Compatibility barrel — the public API of the original hotnessCache.ts is
// preserved unchanged. Implementation now lives in utilities/hotness/.
export {
  checkMemoryPressure,
  getHotness,
  incrementHotness,
  compressData,
  decompressData,
  cacheHit,
  cacheMiss,
  getCachedGameData,
  getCacheStats,
  clearCache,
} from './hotness';
