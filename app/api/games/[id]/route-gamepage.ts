import { NextRequest, NextResponse } from 'next/server';
import { getGameById } from '@/lib/db';
import connectDB from '@/models/games/mongodb/client';
import Game from '@/models/games/mongodb/schema';
import { retry } from '@/lib/retry';
import { validateJWTMiddleware } from '@/lib/jwt-validate';
import {
  cacheHit,
  cacheMiss,
  getCachedGameData,
  getCacheStats,
} from '@/utilities/hotnessCache';
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

    const cachedData = await retry(() => getCachedGameData(id), 2, 300);

    if (cachedData) {
      cacheHit(id, cachedData).catch((err) => {
        const classified = classifyError(err, "route-gamepage.cacheHit");
        console.error('[API /api/games/[id]] Error updating cache hit:', classified.message);
      });
      const stats = await getCacheStats();
      return NextResponse.json(
        { success: true, data: cachedData, cacheStats: stats },
        { headers: { 'X-Cache': 'HIT' } }
      );
    }

    const pgGame = await retry(() => getGameById(id), 2, 300);

    if (!pgGame) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    await connectDB();
    const mongoGame = await retry(() => Game.findOne({ id }).lean(), 2, 300);

    const fullGame = {
      ...pgGame,
      characters: mongoGame?.characters || [],
      maps: mongoGame?.maps || [],
      items: mongoGame?.items || [],
      status: mongoGame?.status || 'draft',
    };

    const missResult = await cacheMiss(id, fullGame);
    const stats = await getCacheStats();

    return NextResponse.json(
      { success: true, data: fullGame, cacheStats: stats },
      { headers: { 'X-Cache': 'MISS' } }
    );
  }, "games/[id]/gamepage");
}
