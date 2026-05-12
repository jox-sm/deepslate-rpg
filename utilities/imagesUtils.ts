import sharp from 'sharp';

export async function convertToWebp(file: File): Promise<Buffer> {
  const buffer = Buffer.from(await file.arrayBuffer());
  
  return await sharp(buffer)
    .webp({ quality: 80 })
    .toBuffer();
}