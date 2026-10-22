import { z } from 'zod';

// ── db.ts ──
export const likesSchema = z.object({
  id: z.string().uuid(),
  likesDelta: z.number().int(),
});
export type Likes = z.infer<typeof likesSchema>;

// ── cards.ts ──
export const cardPropsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  likes_count: z.number().int().min(0),
  tags: z.array(z.string().max(50)).max(20),
  image: z.string(),
});
export type CardProps = z.infer<typeof cardPropsSchema>;

export const gameCardPropsSchema = cardPropsSchema.extend({
  id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type GameCardProps = z.infer<typeof gameCardPropsSchema>;

export const cardGridSchema = z.object({
  numOfCards: z.number().int().min(0),
  cards: z.array(cardPropsSchema),
});
export type CardGrid = z.infer<typeof cardGridSchema>;

export const apiGameResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  image: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  likes_count: z.number().int().optional(),
});

// ── gameForm.ts DB types ──
export const characterDataDBSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().min(1).max(300),
  image: z.string(),
});
export type CharacterDataDB = z.infer<typeof characterDataDBSchema>;

export const mapDataDBSchema = z.object({
  id: z.string().uuid(),
  nameOfPlace: z.string().min(1).max(50),
  image: z.string(),
  sizeOfPlace: z.string().min(1).max(50),
  placesAtMap: z.string().min(1).max(500),
});
export type MapDataDB = z.infer<typeof mapDataDBSchema>;

export const itemDataDBSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  image: z.string(),
});
export type ItemDataDB = z.infer<typeof itemDataDBSchema>;

export const gamesFormDataDBSchema = z.object({
  id: z.string().uuid(),
  characters: z.array(characterDataDBSchema).max(20),
  maps: z.array(mapDataDBSchema).max(20),
  items: z.array(itemDataDBSchema).max(50),
});
export type GamesFormDataDB = z.infer<typeof gamesFormDataDBSchema>;

// ── api.ts ──
export const idempotentRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
}).passthrough();
export type IdempotentRequest = z.infer<typeof idempotentRequestSchema>;

export const idempotentResponseSchema = z.object({
  success: z.boolean(),
  idempotencyKey: z.string().uuid(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  cached: z.boolean().optional(),
});
export type IdempotentResponse = z.infer<typeof idempotentResponseSchema>;

export const idempotencyErrorSchema = z.object({
  type: z.enum(['duplicate_request', 'request_failed', 'timeout']),
  message: z.string(),
  idempotencyKey: z.string().uuid(),
});
export type IdempotencyError = z.infer<typeof idempotencyErrorSchema>;

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    idempotencyKey: z.string().uuid().optional(),
    cached: z.boolean().optional(),
  });

export const paginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasMore: z.boolean(),
  source: z.string(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(dataSchema),
    pagination: paginationSchema,
  });

export const requestStateSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error', 'aborted']),
  idempotencyKey: z.string().uuid().optional(),
  error: z.string().optional(),
  retryCount: z.number().int().min(0),
});
export type RequestState = z.infer<typeof requestStateSchema>;

// ── images.ts ──
// ── Push route schemas ──
export const pushRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  type: z.enum(['game', 'like']),
  data: z.any(),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushGameDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  // Either a remote URL or a bundled path such as "/images/project.jpg"
  // (used as the placeholder cover when no image was uploaded).
  image: z.union([z.string().url(), z.string().regex(/^\/[^\s]*$/)]).optional(),
  tags: z.array(z.string().max(50)).max(10),
  likes_count: z.number().int().min(0).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PushGameData = z.infer<typeof pushGameDataSchema>;

// ── pushGames route schemas (nested game data -> MongoDB) ──
// These mirror models/games/mongodb/schema.ts. MongoDB marks id/name/
// description as required and insertMany() SILENTLY SKIPS documents that
// fail validation, so the API has to reject them up front instead of
// reporting success for a game that was never stored.
export const pushGameCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  image: z.string().nullish().transform((v) => v ?? ""),
});
export type PushGameCharacter = z.infer<typeof pushGameCharacterSchema>;

export const pushGameMapSchema = z.object({
  id: z.string().min(1),
  nameOfPlace: z.string().min(1).max(255),
  sizeOfPlace: z.string().max(500).nullish().transform((v) => v ?? ""),
  placesAtMap: z.string().max(5000).nullish().transform((v) => v ?? ""),
  image: z.string().nullish().transform((v) => v ?? ""),
});
export type PushGameMap = z.infer<typeof pushGameMapSchema>;

export const pushGameItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  image: z.string().nullish().transform((v) => v ?? ""),
});
export type PushGameItem = z.infer<typeof pushGameItemSchema>;

export const pushGamesRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  id: z.string().uuid(),
  // Every nested collection is OPTIONAL. A game can be created with no
  // characters, no maps and no items - and an entry without an image is
  // still a valid entry (the image is just empty).
  characters: z.array(pushGameCharacterSchema).max(50).optional().default([]),
  maps: z.array(pushGameMapSchema).max(50).optional().default([]),
  items: z.array(pushGameItemSchema).max(100).optional().default([]),
});
export type PushGamesRequest = z.infer<typeof pushGamesRequestSchema>;

/**
 * Same payload without the idempotency key - used by the image conversion
 * route, which strips the key itself before doing anything.
 */
export const gameNestedDataSchema = z.object({
  id: z.string().uuid(),
  characters: z.array(pushGameCharacterSchema).max(50).optional().default([]),
  maps: z.array(pushGameMapSchema).max(50).optional().default([]),
  items: z.array(pushGameItemSchema).max(100).optional().default([]),
});
export type GameNestedData = z.infer<typeof gameNestedDataSchema>;

export const uploadProgressSchema = z.object({
  loaded: z.number().min(0),
  total: z.number().min(0),
  percentage: z.number().min(0).max(100),
});
export type UploadProgress = z.infer<typeof uploadProgressSchema>;
