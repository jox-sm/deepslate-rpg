import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/utilities/queue";
import { processGamesQueue } from "@/lib/GamesInsert";
import { drainGames } from "@/utilities/pull";
import { retry } from "@/lib/retry";
import { pushGamesRequestSchema } from "@/types/validation";
import { withIdempotency } from "@/utilities/idempotency";
import { validateJWTMiddleware } from "@/lib/jwt-validate";
import { tryApiRoute } from "@/utilities/apiErrorHandler";

export async function POST(request: NextRequest) {
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const body = await request.json();

    // Validate the payload before it reaches MongoDB. insertMany() silently
    // skips documents that fail schema validation, so an unvalidated payload
    // could be dropped while this route still reported success.
    const parsed = pushGamesRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid game data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { idempotencyKey, ...dbGameData } = parsed.data;

    const { result, cached } = await withIdempotency(idempotencyKey, async () => {
      await retry(() => enqueue("mongodb", "games", dbGameData), 3, 500);
      const [mongoResult, pgResult] = await Promise.all([
        retry(() => processGamesQueue(), 3, 500),
        retry(() => drainGames(), 3, 500),
      ]);
      return { success: true, message: "Game data pushed and both databases synced", data: { mongo: mongoResult, pg: pgResult } };
    });

    return NextResponse.json({ ...result, idempotencyKey, cached });
  }, "push/pushGames");
}
