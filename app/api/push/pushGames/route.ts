import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/utilities/queue";
import { processGamesQueue } from "@/lib/GamesInsert";
import { retry } from "@/lib/retry";
import { GamesFormDataDB } from "@/types/gameForm";
import { withIdempotency } from "@/utilities/idempotency";
import { validateJWTMiddleware } from "@/lib/jwt-validate";
import { tryApiRoute } from "@/utilities/apiErrorHandler";

export async function POST(request: NextRequest) {
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const body = await request.json();
    const { idempotencyKey, ...gameData } = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing idempotencyKey" }, { status: 400 });
    }

    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
      const dbGameData: GamesFormDataDB = gameData;
      await retry(() => enqueue("mongodb", "games", dbGameData), 3, 500);
      await retry(() => processGamesQueue(), 3, 500);
      return { success: true, message: "Game data successfully pushed to Redis queue" };
    });

    return NextResponse.json({ ...result, idempotencyKey, cached });
  }, "push/pushGames");
}
