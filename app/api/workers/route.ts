import { NextResponse } from "next/server";
import { getWorkersStatus } from "@/lib/workers";
import { tryApiRoute } from "@/utilities/apiErrorHandler";

export async function GET() {
  return tryApiRoute(async () => {
    return NextResponse.json({ success: true, ...getWorkersStatus() });
  }, "workers");
}
