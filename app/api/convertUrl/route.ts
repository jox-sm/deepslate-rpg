import { uploadImage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '@/lib/auth';
import { auth } from '@clerk/nextjs/server';
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function POST(req: NextRequest) {
  const { payload, error } = await validateJWTMiddleware(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { idempotencyKey, image: imageBase64 } = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing idempotencyKey" }, { status: 400 });
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: "Missing or invalid image" }, { status: 400 });
    }

    const authResult = await auth();
    const getToken = authResult.getToken;

    if (!getToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseClient = await createAuthenticatedSupabaseClient(getToken);

    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
      const buffer = Buffer.from(imageBase64, 'base64');
      const imageUrl = await uploadImage(buffer, "upload.webp", undefined, supabaseClient);
      return { url: imageUrl };
    });

    return NextResponse.json({ ...result, idempotencyKey, cached });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}