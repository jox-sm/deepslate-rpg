import { NextRequest, NextResponse } from 'next/server';
import { getGamesPaginated } from '@/lib/db';
import { getCachedGameIds, getGameFromCache, warmUpCache } from '@/lib/cache-warmup';
import { retry } from '@/lib/retry';

let cacheInitialized = false;

async function ensureCachePrimed(): Promise<void> {
  if (!cacheInitialized) {
    await warmUpCache();
    cacheInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    await ensureCachePrimed();

    const cachedIds = await retry(() => getCachedGameIds(), 3, 500);
    const cachedCount = cachedIds.length;

    if (offset < cachedCount) {
      const endIndex = Math.min(offset + limit, cachedCount);
      const pageIds = cachedIds.slice(offset, endIndex);

      const cacheResults = [];
      for (const id of pageIds) {
        const cachedGame = await retry(() => getGameFromCache(id), 3, 500);
        if (cachedGame) {
          cacheResults.push(cachedGame);
        }
      }

      return NextResponse.json({
        success: true,
        data: cacheResults,
        pagination: {
          page,
          limit,
          total: cachedCount,
          totalPages: Math.ceil(cachedCount / limit),
          hasMore: endIndex < cachedCount,
          source: 'redis',
        },
      });
    }

    const skip = offset - cachedCount;
    const { games, total } = await retry(() => getGamesPaginated(limit, skip), 3, 500);

    return NextResponse.json({
      success: true,
      data: games,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
        source: 'postgresql',
      },
    });
  } catch (error) {
    console.error('[API /games] Error fetching games:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}