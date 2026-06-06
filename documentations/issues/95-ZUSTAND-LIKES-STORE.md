# Issue #95: Zustand Likes Store - optimistic UI pattern

## Status
✅ CLOSED

## Category
Feature

## Problem Description

Like button interactions required a full round-trip (POST → server → response → UI update), causing visible delays and a poor user experience. No client-side state management existed for likes.

### Code Example - Problem
```typescript
// ❌ OLD: No optimistic updates
export default function LikeButton({ gameId, initialLikes }) {
  const [likes, setLikes] = useState(initialLikes);
  const [loading, setLoading] = useState(false);
  
  const handleLike = async () => {
    setLoading(true); // ❌ Shows spinner on every click
    try {
      const res = await fetch("/api/push", { /* ... */ });
      const data = await res.json();
      setLikes(data.likes_count); // ❌ Updates only after server responds
      successToast("Like registered", "...");
    } catch {
      errorToast("Like failed", "...");
    } finally {
      setLoading(false); // ❌ Spinner visible for 100-500ms
    }
  };
  
  return (
    <button disabled={loading} onClick={handleLike}>
      {loading ? "..." : `❤️ ${likes}`} // ❌ Loading state on every click
    </button>
  );
}
```

## Root Cause

Traditional state management required server confirmation before updating UI, causing:
1. Visible loading spinners on every interaction
2. Janky UX (button disables/enables on each click)
3. No revert mechanism on failure

## Why It's Critical

1. **UX degradation**: Loading spinners on every like click
2. **No offline resilience**: Connection failure = lost like
3. **No batch operations**: Each like requires separate POST

## Solution Implemented

**Zustand store with optimistic toggle and revert:**

```typescript
// ✅ CORRECT: stores/likes-store.ts
import { create } from "zustand";
import { v7 as uuidv7 } from "uuid";
import { successToast, errorToast } from "@/ui/notifications";

interface LikesStore {
  likedGameIds: Set<string>;
  likeCounts: Record<string, number>;
  pendingLikes: Set<string>;
  isLiked: (gameId: string) => boolean;
  getLikeCount: (gameId: string) => number;
  toggleLike: (gameId: string, currentCount: number) => void;
}

export const useLikesStore = create<LikesStore>((set, get) => ({
  likedGameIds: new Set(),
  likeCounts: {},
  pendingLikes: new Set(),

  isLiked: (gameId) => get().likedGameIds.has(gameId),
  getLikeCount: (gameId) => get().likeCounts[gameId] ?? 0,

  toggleLike: (gameId, currentCount) => {
    const state = get();
    if (state.pendingLikes.has(gameId)) return; // Prevent double-clicks

    const previousLiked = state.likedGameIds.has(gameId);
    const previousCount = state.likeCounts[gameId] ?? currentCount;
    const delta = previousLiked ? -1 : 1;

    // Mark as pending
    set((s) => {
      const pending = new Set(s.pendingLikes);
      pending.add(gameId);
      return { pendingLikes: pending };
    });

    // ✅ Optimistic update (instant UI)
    if (previousLiked) {
      set((s) => {
        const next = new Set(s.likedGameIds);
        next.delete(gameId);
        return {
          likedGameIds: next,
          likeCounts: { ...s.likeCounts, [gameId]: Math.max(0, (s.likeCounts[gameId] ?? 1) - 1) },
        };
      });
    } else {
      set((s) => {
        const next = new Set(s.likedGameIds);
        next.add(gameId);
        return {
          likedGameIds: next,
          likeCounts: { ...s.likeCounts, [gameId]: (s.likeCounts[gameId] ?? 0) + 1 },
        };
      });
    }

    // Fire POST (no await - fire and forget)
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: uuidv7(),
        type: "like",
        data: { id: gameId, likesDelta: delta },
      }),
    })
      .then((res) => {
        if (res.ok) {
          set((s) => {
            const pending = new Set(s.pendingLikes);
            pending.delete(gameId);
            return { pendingLikes: pending };
          });
          successToast("Like registered", previousLiked ? "Like removed." : "Your like has been saved.");
        } else {
          throw new Error("Server error");
        }
      })
      .catch(() => {
        set((s) => {
          const next = new Set(s.likedGameIds);
          if (previousLiked) next.add(gameId);
          else next.delete(gameId);
          const pending = new Set(s.pendingLikes);
          pending.delete(gameId);
          return {
            likedGameIds: next,
            likeCounts: { ...s.likeCounts, [gameId]: previousCount },
            pendingLikes: pending,
          };
        });
        errorToast("Like failed", "Could not register your like. Please try again.");
      });
  },
}));
```

## Files Modified

| File | Change |
|------|--------|
| `stores/likes-store.ts` | **Created** - Zustand store with optimistic toggle and revert |
| `components/adventures/cards/like-button.tsx` | **Created** - Heart SVG button with count display |
| `components/adventures/cards/cards.tsx` | Wired `<LikeButton>` below card name |

## Tradeoffs

| Pros | Cons |
|------|------|
| Instant UI feedback (<1ms) | Zustand adds ~1.1KB bundle |
| Graceful revert on failure | More complex than useState |
| Prevents double-clicks via pending flag | Must track previous state for revert |
| Toast notifications for success/error | Toast state must be managed separately |
| No loading spinners | Optimistic updates can show stale data briefly |

## Verification Checklist

- [x] Like click updates UI instantly (no spinner)
- [x] `likedGameIds` Set toggles on click
- [x] `likeCounts` increments/decrements
- [x] `pendingLikes` prevents double-clicks
- [x] `successToast` shown on 200 response
- [x] `errorToast` shown on failure with revert
- [x] `toggleLike(gameId, initialLikes)` fires POST (no await)
- [x] Lint and typecheck clean


## Depends On
- [#89](89-LIKES-SYSTEM-INSTANT-WRITE.md)

## Blocks
— (none)

## Related Issues

- #89: Refactor likes: Upstash instant + async queue drain (server-side instant write)
- #90: Centralize Redis queue utilities (uses `enqueue`)
- #91: State sync with JSON Patch (parallel pattern for game mutations)
