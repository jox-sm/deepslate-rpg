import { uploadImage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '@/lib/auth';
import { auth } from '@clerk/nextjs/server';
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';

export async function POST(req: NextRequest) {
  // Validate JWT token
  const { payload, error } = await validateJWTMiddleware(req);
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    const idempotencyKey = body?.idempotencyKey;
    
    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing idempotencyKey" }, { status: 400 });
    }

    const authResult = await auth();
    const getToken = authResult.getToken;
    
    if (!getToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const supabaseClient = await createAuthenticatedSupabaseClient(getToken);
    
    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
      const blob = await req.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const imageUrl = await uploadImage(buffer, "upload.webp", undefined, supabaseClient);
      return { url: imageUrl };
    });

    return NextResponse.json({ ...result, idempotencyKey, cached });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}