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
  _optimisticAdd: (gameId: string) => void;
  _optimisticRemove: (gameId: string) => void;
  _revert: (gameId: string, previousLiked: boolean, previousCount: number) => void;
  _apply: (gameId: string) => void;
  setInitialLiked: (ids: string[]) => void;
}

export const useLikesStore = create<LikesStore>((set, get) => ({
  likedGameIds: new Set(),
  likeCounts: {},
  pendingLikes: new Set(),

  isLiked: (gameId) => get().likedGameIds.has(gameId),
  getLikeCount: (gameId) => get().likeCounts[gameId] ?? 0,

  _optimisticAdd: (gameId) =>
    set((state) => {
      const next = new Set(state.likedGameIds);
      next.add(gameId);
      return {
        likedGameIds: next,
        likeCounts: { ...state.likeCounts, [gameId]: (state.likeCounts[gameId] ?? 0) + 1 },
      };
    }),

  _optimisticRemove: (gameId) =>
    set((state) => {
      const next = new Set(state.likedGameIds);
      next.delete(gameId);
      return {
        likedGameIds: next,
        likeCounts: { ...state.likeCounts, [gameId]: Math.max(0, (state.likeCounts[gameId] ?? 1) - 1) },
      };
    }),

  _revert: (gameId, previousLiked, previousCount) =>
    set((state) => {
      const next = new Set(state.likedGameIds);
      if (previousLiked) next.add(gameId);
      else next.delete(gameId);
      const pending = new Set(state.pendingLikes);
      pending.delete(gameId);
      return {
        likedGameIds: next,
        likeCounts: { ...state.likeCounts, [gameId]: previousCount },
        pendingLikes: pending,
      };
    }),

  _apply: (gameId) =>
    set((state) => {
      const pending = new Set(state.pendingLikes);
      pending.delete(gameId);
      return { pendingLikes: pending };
    }),

  setInitialLiked: (ids) =>
    set(() => ({
      likedGameIds: new Set(ids),
    })),

  toggleLike: (gameId, currentCount) => {
    const state = get();
    if (state.pendingLikes.has(gameId)) return;

    const previousLiked = state.likedGameIds.has(gameId);
    const previousCount = state.likeCounts[gameId] ?? currentCount;
    const delta = previousLiked ? -1 : 1;

    set((s) => {
      const pending = new Set(s.pendingLikes);
      pending.add(gameId);
      return { pendingLikes: pending };
    });

    if (previousLiked) {
      get()._optimisticRemove(gameId);
    } else {
      get()._optimisticAdd(gameId);
    }

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
          get()._apply(gameId);
          successToast("Like registered", previousLiked ? "Like removed." : "Your like has been saved.");
        } else {
          throw new Error("Server error");
        }
      })
      .catch(() => {
        get()._revert(gameId, previousLiked, previousCount);
        errorToast("Like failed", "Could not register your like. Please try again.");
      });
  },
}));
