export async function retry<T>(
  fn: () => Promise<T>,
  maxTries: number = 3,
  delayMs: number = 500,
  exponentialBackoff: boolean = false
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxTries) {
        const currentDelay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
        await new Promise(resolve => setTimeout(resolve, currentDelay));
      }
    }
  }
  
  throw lastError;
}