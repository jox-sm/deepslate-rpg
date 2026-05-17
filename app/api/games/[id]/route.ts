import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/queue';
import { getGameById } from '@/lib/db';
import connectDB from '@/models/games/mongodb/client';
import Game from '@/models/games/mongodb/schema';
import { getGameFromCache, setGameInCache } from '@/lib/cache-warmup';
import { retry } from '@/lib/retry';

const CACHE_KEYS = {
  GAME_PREFIX: 'game:',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid game ID' },
        { status: 400 }
      );
    }

    const cachedGame = await retry(() => getGameFromCache(id), 3, 500);

    if (cachedGame) {
      console.log(`[API /games/[id]] Cache HIT for game: ${id}`);
      return NextResponse.json(
        { success: true, data: cachedGame },
        { headers: { 'X-Cache': 'HIT' } }
      );
    }

    console.log(`[API /games/[id]] Cache MISS for game: ${id}, fetching from DBs`);

    const pgGame = await retry(() => getGameById(id), 3, 500);

    if (!pgGame) {
      console.log(`[API /games/[id]] Game not found in PostgreSQL: ${id}`);
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
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
      console.error(`[API /games/[id]] Failed to backfill cache for ${id}:`, err);
    });

    return NextResponse.json(
      { success: true, data: fullGame },
      { headers: { 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('[API /games/[id]] Error fetching game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}