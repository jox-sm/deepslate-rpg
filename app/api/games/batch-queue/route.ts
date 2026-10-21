import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queueGameFetch } from "@/utilities/gameFetchPipeline";
import { validateJWTMiddleware } from "@/lib/jwt-validate";
import { tryApiRoute } from "@/utilities/apiErrorHandler";

const batchQueueSchema = z.object({
  uuid: z.string().uuid(),
  requestId: z.string().uuid(),
});

/**
 * POST /api/games/batch-queue
 *
 * Enqueues a game fetch request. The background worker batches these
 * requests so a burst of GamePage views becomes one Neon query plus one
 * MongoDB query per distinct game, instead of one query pair per request.
 *
 * The client then polls /api/games/batch-result/[requestId] for the result.
 */
export async function POST(request: NextRequest) {
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const body = await request.json();
    const parsed = batchQueueSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    await queueGameFetch(parsed.data.uuid, parsed.data.requestId);

    return NextResponse.json({ success: true, requestId: parsed.data.requestId });
  }, "games/batch-queue");
}
