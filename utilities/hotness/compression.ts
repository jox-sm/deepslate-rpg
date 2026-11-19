import pako from 'pako';
import { classifyError } from '@/utilities/errorHandler';

/**
 * Compress data using pako gzip for Redis storage
 */
export function compressData(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    const compressed = pako.gzip(json);
    return Buffer.from(compressed).toString('base64');
  } catch (error) {
    const classified = classifyError(error, "HotnessCache.compressData");
    console.error('[HotnessCache] Error compressing data:', classified.message);
    return JSON.stringify(data);
  }
}

/**
 * Decompress data from Redis storage
 */
export function decompressData(compressed: string): unknown {
  try {
    const buffer = Buffer.from(compressed, 'base64');
    const decompressed = pako.ungzip(buffer, { to: 'string' });
    return JSON.parse(decompressed);
  } catch {
    // Fall back to direct JSON parsing if not compressed
    try {
      return JSON.parse(compressed);
    } catch (error) {
      const classified = classifyError(error, "HotnessCache.decompressData");
      console.error('[HotnessCache] Error decompressing data:', classified.message);
      return null;
    }
  }
}
