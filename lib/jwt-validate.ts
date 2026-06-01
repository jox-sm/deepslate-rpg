import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export interface JWTPayload {
  userId: string;
  email?: string;
  [key: string]: unknown;
}

export async function validateJWTMiddleware(
  _request: NextRequest
): Promise<{ payload: JWTPayload; error: null } | { payload: null; error: NextResponse }> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        payload: null,
        error: NextResponse.json(
          { success: false, error: 'Not authenticated' },
          { status: 401 }
        ),
      };
    }

    return {
      payload: { userId },
      error: null,
    };
  } catch (error) {
    return {
      payload: null,
      error: NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        },
        { status: 401 }
      ),
    };
  }
}
