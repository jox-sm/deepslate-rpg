import { uploadImage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const blob = await req.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const imageUrl = await uploadImage(buffer, "upload.webp");

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}