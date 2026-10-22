import { NextRequest, NextResponse } from 'next/server';
import { convertComponentImagesJSON } from '@/utilities/insertGameImages';
import { createAuthenticatedSupabaseClient } from '@/lib/auth';
import { auth } from '@clerk/nextjs/server';
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { tryApiRoute } from '@/utilities/apiErrorHandler';
import { gameNestedDataSchema } from '@/types/validation';

export async function POST(req: NextRequest) {
  const { error } = await validateJWTMiddleware(req);
  if (error) return error;

  return tryApiRoute(async () => {
    const body = await req.json();
    const { idempotencyKey, ...rest } = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing idempotencyKey" }, { status: 400 });
    }

    // Every nested collection is optional - a game may legitimately have no
    // characters, no maps and no items.
    const parsed = gameNestedDataSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid game data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const authResult = await auth();
    const getToken = authResult.getToken;
    
    if (!getToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const supabaseClient = await createAuthenticatedSupabaseClient(getToken);
    
    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
      return await convertComponentImagesJSON(parsed.data, supabaseClient);
    });

    return NextResponse.json({ ...result, idempotencyKey, cached });
  }, "convertUrl/ConvertGameImages");
}