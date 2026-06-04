import { NextRequest, NextResponse } from 'next/server';
import { getGameById } from '@/lib/db';
import connectDB from '@/models/games/mongodb/client';
import Game from '@/models/games/mongodb/schema';
import { getGameFromCache, setGameInCache } from '@/lib/cache-warmup';
import { retry } from '@/lib/retry';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import { tryApiRoute } from '@/utilities/apiErrorHandler';
import { classifyError } from '@/utilities/errorHandler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;

  return tryApiRoute(async () => {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid game ID' }, { status: 400 });
    }

    const cachedGame = await retry(() => getGameFromCache(id), 3, 500);

    if (cachedGame) {
      return NextResponse.json({ success: true, data: cachedGame }, { headers: { 'X-Cache': 'HIT' } });
    }

    const pgGame = await retry(() => getGameById(id), 3, 500);

    if (!pgGame) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    await connectDB();
    const mongoGame = await retry(() => Game.findOne({ id }).lean(), 3, 500);

    const fullGame = {
      ...pgGame,
      characters: mongoGame?.characters || [],
      maps: mongoGame?.maps || [],
      items: mongoGame?.items || [],
      status: mongoGame?.status || 'draft',
    };

    retry(() => setGameInCache(id, fullGame), 3, 500).catch((err) => {
      const classified = classifyError(err, `route-games.backfill.${id}`);
      console.error(`[API /games/[id]] Failed to backfill cache for ${id}:`, classified.message);
    });

    return NextResponse.json({ success: true, data: fullGame }, { headers: { 'X-Cache': 'MISS' } });
  }, "games/[id]");
}