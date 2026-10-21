import { NextRequest, NextResponse } from "next/server";
import { getFetchResult } from "@/utilities/gameFetchPipeline";
import { validateJWTMiddleware } from "@/lib/jwt-validate";
import { tryApiRoute } from "@/utilities/apiErrorHandler";

/**
 * GET /api/games/batch-result/[requestId]
 *
 * Returns the result produced by the batch fetch worker for a request id
 * previously submitted to /api/games/batch-queue.
 *
 * 404 means "not ready yet" - the client keeps polling. The result key is
 * consumed on the first successful read.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const { requestId } = await params;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ success: false, error: "Invalid request ID" }, { status: 400 });
    }

    const data = await getFetchResult(requestId);

    if (!data) {
      return NextResponse.json(
        { success: false, pending: true, error: "Result not ready" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  }, "games/batch-result");
}
