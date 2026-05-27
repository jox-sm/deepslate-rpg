/**
 * Utility function to create a promise that resolves after a specified time
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after ms milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}