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

/**
 * GamePage API Route with Hotness Cache Integration
 *
 * Three-tier fetch strategy:
 * 1. Check hotness cache for existing data
 * 2. Handle cache hits/misses with hotness tracking
 * 3. Fall back to direct DB fetch if needed
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate JWT token
  const { payload, error } = await validateJWTMiddleware(request);
  if (error) return error;

  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid game ID' },
        { status: 400 }
      );
    }

    // Tier 1: Check hotness cache
    console.log(`[API /api/games/[id]] Checking cache for game: ${id}`);

    const cachedData = await retry(
      () => getCachedGameData(id),
      2,
      300
    );

    if (cachedData) {
      console.log(`[API /api/games/[id]] Cache HIT for game: ${id}`);

      // Update cache metrics (async)
      cacheHit(id, cachedData).catch((err) =>
        console.error('[API /api/games/[id]] Error updating cache hit:', err)
      );

      const stats = await getCacheStats();
      return NextResponse.json(
        { success: true, data: cachedData, cacheStats: stats },
        { headers: { 'X-Cache': 'HIT' } }
      );
    }

    console.log(
      `[API /api/games/[id]] Cache MISS for game: ${id}, fetching from DBs`
    );

    // Tier 2: Fetch from DBs
    const pgGame = await retry(() => getGameById(id), 2, 300);

    if (!pgGame) {
      console.log(`[API /api/games/[id]] Game not found in PostgreSQL: ${id}`);
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Fetch nested data from MongoDB
    await connectDB();
    const mongoGame = await retry(
      () => Game.findOne({ id }).lean(),
      2,
      300
    );

    const fullGame = {
      ...pgGame,
      characters: mongoGame?.characters || [],
      maps: mongoGame?.maps || [],
      items: mongoGame?.items || [],
      status: mongoGame?.status || 'draft',
    };

    // Handle cache miss (may promote to cache)
    const missResult = await cacheMiss(id, fullGame);
    console.log(
      `[API /api/games/[id]] Cache miss handled: ${missResult.status}`
    );

    const stats = await getCacheStats();
    return NextResponse.json(
      { success: true, data: fullGame, cacheStats: stats },
      { headers: { 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('[API /api/games/[id]] Error fetching game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}
