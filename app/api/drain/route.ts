import type { NextRequest } from "next/server";
import { drainGames, drainLikes } from "@/utilities/pull";
import { validateJWTMiddleware } from "@/lib/jwt-validate";
import { tryApiRoute } from "@/utilities/apiErrorHandler";

const LIKES_INTERVAL_MS = 10_000;
const GAMES_INTERVAL_MS = 1_000;

let lastLikesDrain = 0;
let lastGamesDrain = 0;

export async function GET(request: NextRequest) {
  const { error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get("force") === "true";
    const target = searchParams.get("target");

    const now = Date.now();
    const results: { likes?: { processed: number }; games?: { processed: number } } = {};

    const shouldDrainLikes = force || target === "likes" || now - lastLikesDrain >= LIKES_INTERVAL_MS;
    if (shouldDrainLikes) {
      try {
        const likesResult = await drainLikes();
        results.likes = likesResult;
        lastLikesDrain = now;
      } catch {
        // error already logged in drainLikes
      }
    }

    const shouldDrainGames = force || target === "games" || now - lastGamesDrain >= GAMES_INTERVAL_MS;
    if (shouldDrainGames) {
      try {
        const gamesResult = await drainGames();
        results.games = gamesResult;
        lastGamesDrain = now;
      } catch {
        // error already logged in drainGames
      }
    }

    return {
      skipped: !shouldDrainLikes && !shouldDrainGames,
      nextLikesDrainIn: Math.max(0, LIKES_INTERVAL_MS - (now - lastLikesDrain)),
      nextGamesDrainIn: Math.max(0, GAMES_INTERVAL_MS - (now - lastGamesDrain)),
      ...results,
    };
  }, "drain");
}
