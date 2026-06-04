import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { classifyError } from '@/utilities/errorHandler';

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
    const classified = classifyError(error, "jwt-validate.validateJWTMiddleware");
    return {
      payload: null,
      error: NextResponse.json(
        { success: false, error: classified.message },
        { status: 401 }
      ),
    };
  }
}
