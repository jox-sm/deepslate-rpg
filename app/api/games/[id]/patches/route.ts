import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateJWTMiddleware } from "@/lib/jwt-validate";
import { tryApiRoute } from "@/utilities/apiErrorHandler";
import { applyGamePatches } from "@/lib/patch-applier";
import type { GamePatch } from "@/types/patches";

const patchOpSchema = z.object({
  op: z.enum(["add", "remove", "replace"]),
  path: z.string().min(1),
  value: z.unknown().optional(),
});

const patchRequestSchema = z.object({
  patches: z.array(patchOpSchema).min(1).max(100),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchRequestSchema.parse(body);
    const patches = parsed.patches as unknown as GamePatch[];

    const result = await applyGamePatches({ id, patches });

    return NextResponse.json(
      { success: true, data: result },
      { status: result.errors > 0 ? 207 : 200 }
    );
  }, "games.patches");
}
