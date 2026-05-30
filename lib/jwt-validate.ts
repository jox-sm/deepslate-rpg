import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Extract JWT token from Authorization header
 */
export function extractTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Validate JWT token for Clerk template
 */
export function validateClerkJWT(token: string): JWTPayload {
  const secret = process.env.CLERK_JWT_SECRET;
  if (!secret) {
    throw new Error('CLERK_JWT_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error(`Invalid Clerk JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate JWT token for Neon template
 */
export function validateNeonJWT(token: string): JWTPayload {
  const secret = process.env.NEON_JWT_SECRET;
  if (!secret) {
    throw new Error('NEON_JWT_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error(`Invalid Neon JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate JWT token for MongoDB template
 */
export function validateMongoDBJWT(token: string): JWTPayload {
  const secret = process.env.MONGODB_JWT_SECRET;
  if (!secret) {
    throw new Error('MONGODB_JWT_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error(`Invalid MongoDB JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate JWT from any configured template
 * Tries each in order: Clerk -> Neon -> MongoDB
 */
export function validateJWT(token: string, template?: 'clerk' | 'neon' | 'mongodb'): JWTPayload {
  if (template === 'clerk') return validateClerkJWT(token);
  if (template === 'neon') return validateNeonJWT(token);
  if (template === 'mongodb') return validateMongoDBJWT(token);

  // Try all templates if none specified
  const validators = [
    () => validateClerkJWT(token),
    () => validateNeonJWT(token),
    () => validateMongoDBJWT(token),
  ];

  for (const validate of validators) {
    try {
      return validate();
    } catch {
      // Try next validator
    }
  }

  throw new Error('Failed to validate JWT with any template');
}

/**
 * Middleware to validate JWT in API routes
 * Usage: const payload = await validateJWTMiddleware(request);
 */
export async function validateJWTMiddleware(
  request: NextRequest,
  template?: 'clerk' | 'neon' | 'mongodb'
): Promise<{ payload: JWTPayload; error: null } | { payload: null; error: NextResponse }> {
  try {
    const token = extractTokenFromHeader(request);
    if (!token) {
      return {
        payload: null,
        error: NextResponse.json(
          { success: false, error: 'Missing authorization token' },
          { status: 401 }
        ),
      };
    }

    const payload = validateJWT(token, template);
    return { payload, error: null };
  } catch (error) {
    return {
      payload: null,
      error: NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'JWT validation failed',
        },
        { status: 401 }
      ),
    };
  }
}
