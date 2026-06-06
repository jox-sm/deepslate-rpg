# Issue #91: State Sync Foundation - JSON Patch for In-Game Mutations

## Status
✅ CLOSED

## Category
Feature

## Problem Description

In-game editing (adding/removing/replacing characters, maps, items) had no mechanism to persist changes to MongoDB. The game detail page could display data but mutations were ephemeral — lost on page reload.

### Code Example - Problem
```typescript
// ❌ OLD: No mutation tracking
export default function GameEditor({ game }) {
  const [characters, setCharacters] = useState(game.characters);
  
  const addCharacter = (char) => {
    setCharacters([...characters, char]);
    // ❌ Problem: No save mechanism
    // Character exists in React state only
    // Lost on page reload
  };
  
  const deleteCharacter = (id) => {
    setCharacters(characters.filter(c => c.id !== id));
    // ❌ Problem: No API to persist deletion
  };
}
```

## Root Cause

No API endpoint existed for updating individual fields on MongoDB game documents. The only write path was the full-game creation pipeline (`POST /api/push`), which overwrites the entire document.

## Why It's Critical

1. **Data loss**: Mutations lost on page refresh
2. **No incremental updates**: Full document overwrite required
3. **No offline support**: No backup/recovery mechanism
4. **UX broken**: User edits are ephemeral

## Solution Implemented

**JSON Patch (RFC 6902) for game state mutations:**

### 1. Patch Types (`types/patches.ts`)
```typescript
export type GamePatchOp = "add" | "remove" | "replace";
export type GameArrayKey = "characters" | "maps" | "items";

export type CharacterPatch =
  | { op: "add"; path: "/characters/-"; value: CharacterDataJSON }
  | { op: "remove"; path: `/characters/${string}` }
  | { op: "replace"; path: `/characters/${string}/name`; value: string };

export type GamePatchRequest = {
  id: string;
  patches: GamePatch[];
};

export type GamePatchResponse = {
  gameId: string;
  applied: number;
  skipped: number;
  errors: number;
  results: GamePatchResult[];
};
```

### 2. Server-Side Applier (`lib/patch-applier.ts`)
```typescript
async function applyAdd(gameId: string, patch: GamePatch): Promise<void> {
  const arrayKey = getArrayKeyFromPath(patch.path); // "characters" | "maps" | "items"
  await Game.updateOne(
    { id: gameId },
    { $push: { [arrayKey]: patch.value } }
  );
}

async function applyRemove(gameId: string, patch: GamePatch): Promise<void> {
  const arrayKey = getArrayKeyFromPath(patch.path);
  const id = getIdFromPath(patch.path); // extract UUID from path
  await Game.updateOne(
    { id: gameId },
    { $pull: { [arrayKey]: { id } } }
  );
}

async function applyReplace(gameId: string, patch: GamePatch): Promise<void> {
  const arrayKey = getArrayKeyFromPath(patch.path);
  const id = getIdFromPath(patch.path);
  const field = getFieldFromPath(patch.path); // "name" | "description" | "image"
  const mongoPath = `${arrayKey}.$[elem].${field}`;
  await Game.updateOne(
    { id: gameId },
    { $set: { [mongoPath]: patch.value } },
    { arrayFilters: [{ "elem.id": id }] }
  );
}
```

### 3. Patch Endpoint (`app/api/games/[id]/patches/route.ts`)
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = patchRequestSchema.parse(body);
  const patches = parsed.patches as unknown as GamePatch[];
  const result = await applyGamePatches({ id, patches });
  return NextResponse.json({ success: true, data: result });
}
```

### 4. Client-Side Mutation Tracker (`hooks/use-mutation-tracker.ts`)
```typescript
export function useMutationTracker(gameId: string) {
  const [patches, setPatches] = useState<GamePatch[]>([]);
  const [dirty, setDirty] = useState(false);
  
  // Auto-backup to localStorage every 10 minutes
  useEffect(() => {
    if (patches.length === 0) return;
    const timer = setInterval(() => {
      backupPatches(gameId, patches);
    }, 600_000);
    return () => clearInterval(timer);
  }, [gameId, patches.length]);
  
  // Save-on-exit prompt
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (patches.length > 0) {
        backupPatches(gameId, patches);
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [gameId, patches.length]);
  
  const recordAdd = useCallback((key: GameArrayKey, value: object) => {
    setPatches((prev) => [...prev, { op: "add", path: `/${key}/-`, value }]);
    setDirty(true);
  }, []);
  
  const recordRemove = useCallback((key: GameArrayKey, id: string) => {
    setPatches((prev) => [...prev, { op: "remove", path: `/${key}/${id}` }]);
    setDirty(true);
  }, []);
  
  const recordReplace = useCallback((key: GameArrayKey, id: string, field: string, value: unknown) => {
    setPatches((prev) => [...prev, { op: "replace", path: `/${key}/${id}/${field}`, value }]);
    setDirty(true);
  }, []);
  
  const save = useCallback(async () => {
    if (patches.length === 0) return { success: true };
    const res = await fetch(`/api/games/${gameId}/patches`, {
      method: "POST",
      body: JSON.stringify({ patches }),
    });
    const json = await res.json();
    if (res.ok) {
      setPatches([]);
      clearBackup(gameId);
      setDirty(false);
    }
    return json;
  }, [gameId, patches]);
  
  return { patches, recordAdd, recordRemove, recordReplace, save, dirty };
}
```

### 5. LocalStorage Backup (`lib/mutation-backup.ts`)
```typescript
export function backupPatches(gameId: string, patches: GamePatch[]): void {
  localStorage.setItem(`patches:${gameId}`, JSON.stringify({
    patches,
    timestamp: Date.now(),
  }));
}

export function restorePatches(gameId: string): GamePatch[] | null {
  const raw = localStorage.getItem(`patches:${gameId}`);
  if (!raw) return null;
  const entry = JSON.parse(raw);
  return entry.patches;
}

export function clearBackup(gameId: string): void {
  localStorage.removeItem(`patches:${gameId}`);
}
```

## Files Modified

| File | Change |
|------|--------|
| `types/patches.ts` | **Created** - Patch types (GamePatch, GamePatchRequest, etc.) |
| `lib/patch-applier.ts` | **Created** - MongoDB `$push/$pull/$set` applier |
| `app/api/games/[id]/patches/route.ts` | **Created** - POST endpoint for patches |
| `hooks/use-mutation-tracker.ts` | **Created** - Client-side mutation tracker |
| `lib/mutation-backup.ts` | **Created** - LocalStorage backup/restore |

## Tradeoffs

| Pros | Cons |
|------|------|
| Incremental updates (no full overwrite) | More complex than simple REST |
| Client-side diff tracking | Requires Zod validation per patch op |
| Offline recovery via LocalStorage | `arrayFilters` in MongoDB (limited nesting) |
| Per-patch error reporting | Not atomic (one bad patch fails the batch) |
| RFC 6902 standard format | Slightly more complex than GraphQL mutations |

## Verification Checklist

- [x] `POST /api/games/[id]/patches` accepts `{ patches: [...] }`
- [x] `add` op: `Game.updateOne({ $push: { characters: value } })`
- [x] `remove` op: `Game.updateOne({ $pull: { characters: { id } } })`
- [x] `replace` op: `Game.updateOne({ $set: { "characters.$[elem].name": value }, arrayFilters: [...] })`
- [x] `useMutationTracker` records patches on add/remove/replace
- [x] `save()` posts patches and clears queue on success
- [x] `backupPatches()` writes to `localStorage`
- [x] `restorePatches()` reads from `localStorage`
- [x] `beforeunload` triggers backup when dirty
- [x] Lint and typecheck clean


## Depends On
- [#90](90-CENTRALIZED-REDIS-QUEUES.md)

## Blocks
— (none)

## Related Issues

- #90: Centralized Redis Queues (uses `enqueue` for future queue-based mutations)
- #89: Likes System Instant Write (parallel pattern for instant UI)
- #92: Zustand Likes Store (client-side optimistic pattern)
