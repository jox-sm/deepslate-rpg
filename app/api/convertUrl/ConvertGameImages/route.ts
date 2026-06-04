import { NextRequest, NextResponse } from 'next/server';
import { convertComponentImagesJSON } from '@/utilities/insertGameImages';
import { GamesFormDataDB } from "@/types/gameForm";
import { createAuthenticatedSupabaseClient } from '@/lib/auth';
import { auth } from '@clerk/nextjs/server';
import { withIdempotency } from '@/utilities/idempotency';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { tryApiRoute } from '@/utilities/apiErrorHandler';

export async function POST(req: NextRequest) {
  const { payload, error } = await validateJWTMiddleware(req);
  if (error) return error;

  return tryApiRoute(async () => {
    const body = await req.json();
    const { idempotencyKey, ...gameData } = body;

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
      const dbGameData: GamesFormDataDB = gameData;
      return await convertComponentImagesJSON(dbGameData, supabaseClient);
    });

    return NextResponse.json({ ...result, idempotencyKey, cached });
  }, "convertUrl/ConvertGameImages");
}