"use client";
import { useLikesStore } from "@/stores/likes-store";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  gameId: string;
  initialLikes: number;
}

export default function LikeButton({ gameId, initialLikes }: LikeButtonProps) {
  const isLiked = useLikesStore((s) => s.isLiked(gameId));
  const getLikeCount = useLikesStore((s) => s.getLikeCount(gameId));
  const pendingLikes = useLikesStore((s) => s.pendingLikes.has(gameId));
  const toggleLike = useLikesStore((s) => s.toggleLike);
  const displayCount = getLikeCount > 0 ? getLikeCount : initialLikes;
  const liked = isLiked;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pendingLikes) toggleLike(gameId, initialLikes);
  };

  return (
    <button
      onClick={handleClick}
      disabled={pendingLikes}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200",
        "hover:scale-105 active:scale-95",
        liked
          ? "text-ember-400 bg-ember-600/15 border border-ember-600/30"
          : "text-slate-400 bg-slate-800/50 border border-slate-700/30 hover:text-slate-300",
        pendingLikes && "opacity-50 cursor-not-allowed",
      )}
      aria-label={liked ? "Unlike" : "Like"}
    >
      {liked ? (
        <svg className="w-3.5 h-3.5 fill-ember-400" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      )}
      <span>{displayCount}</span>
    </button>
  );
}
