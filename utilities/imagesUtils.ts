// utilities/imagesUtils.ts
import sharp from 'sharp';
import type { UploadOptions } from '@/types/images';

export async function convertToWebp(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .webp({ quality: 80 })
    .toBuffer();
}
export async function uploadImageWithProgress(
  buffer: Buffer,
  fileName: string,
  uploadFn: (buffer: Buffer, fileName: string) => Promise<string>,
  options?: UploadOptions
): Promise<string> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const result = await uploadFn(buffer, fileName);

  if (options?.onProgress) {
    options.onProgress({ loaded: buffer.length, total: buffer.length, percentage: 100 });
  }

  return result;
}

export function createUploadController() {
  const controllers = new Map<string, AbortController>();

  return {
    start(key: string): AbortController {
      const controller = new AbortController();
      controllers.set(key, controller);
      return controller;
    },
    cancel(key: string): void {
      const controller = controllers.get(key);
      if (controller) {
        controller.abort();
        controllers.delete(key);
      }
    },
    cancelAll(): void {
      controllers.forEach(controller => controller.abort());
      controllers.clear();
    },
  };
}