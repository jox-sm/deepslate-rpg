// utilities/imagesUtils.ts
import sharp from 'sharp';

export async function convertToWebp(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .webp({ quality: 80 })
    .toBuffer();
}