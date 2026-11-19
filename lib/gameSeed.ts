// lib/gameSeed.ts — carries a catalog game's creative payload into the first
// AI request of a play session. The web's game page stashes the seed (mapped
// from its GameDataJSON shape) in sessionStorage under rpg:seed:{sid}; the
// PlayScreen consumes it on turn 1 so the engine builds that game's campaign
// into game_data (see REDIS_API.md → "Session Seeding from a Catalog Game").
// sessionStorage is single-tab by design: the seed is per-navigation.
"use client";

export interface SeedCharacter {
  id?: string;
  name?: string;
  description?: string;
}

export interface SeedMap {
  id?: string;
  name?: string;
  places_at?: string;
  size?: string;
}

export interface SeedItem {
  id?: string;
  name?: string;
}

export interface GameSeed {
  /** Catalog game id. Doubles as the engine's world_seed: every session of the same game lands in the same deterministic world. */
  game_id: string;
  name: string;
  description?: string;
  characters?: SeedCharacter[];
  maps?: SeedMap[];
  items?: SeedItem[];
}

const key = (sid: string) => `rpg:seed:${sid}`;

export function saveGameSeed(sid: string, seed: GameSeed): boolean {
  try {
    sessionStorage.setItem(key(sid), JSON.stringify(seed));
    return true;
  } catch (error) {
    console.error("[gameSeed] save failed:", error);
    return false;
  }
}

/** Reads the seed for a session and consumes it (single-use by design). */
export function takeGameSeed(sid: string): GameSeed | null {
  try {
    const raw = sessionStorage.getItem(key(sid));
    if (!raw) return null;
    sessionStorage.removeItem(key(sid));
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof (parsed as GameSeed).game_id === "string") {
      return parsed as GameSeed;
    }
    return null;
  } catch {
    return null;
  }
}
