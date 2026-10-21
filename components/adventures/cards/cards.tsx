'use client';
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { CardProps } from "@/types/cards";
import { useGamePreloadStore } from "@/utilities/clientUtilities/useGameCache";
import { cn } from "@/lib/utils";
import { FittedImage } from "@/components/shared/FittedImage";
import LikeButton from "@/components/adventures/cards/like-button";

export default function ProfileCard({
  id,
  image,
  name,
  description,
  tags,
  likes_count,
}: CardProps) {
  const router = useRouter();
  const { setPreload } = useGamePreloadStore();
  const tagsKey = tags.join(',');

  useEffect(() => {
    posthog.capture('adventure_card_viewed', { name, tags });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, tagsKey]);

  const handleClick = () => {
    setPreload(id, { name, description, image, tags, likes_count });
    posthog.capture('adventure_card_clicked', { id, name, tags: tagsKey });
    router.push(`/game/${id}`);
  };

  const visibleTags = tags.slice(0, 3);
  const extraCount = tags.length - visibleTags.length;

  return (
    <article
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      className="dungeon-card group cursor-pointer overflow-hidden transition-colors"
    >
      <div className="relative">
        <FittedImage
          src={image}
          alt={name}
          aspectRatio="16/10"
          className="transition-transform duration-500 ease-ember group-hover:scale-[1.03]"
          showOverlay
        />
        <span className="absolute left-3 top-3 rounded-full border border-border bg-bg-base/85 px-2.5 py-1 text-[11px] font-medium text-text-secondary backdrop-blur">
          Delve
        </span>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 font-display text-lg font-semibold tracking-tight text-text-primary">
            {name}
          </h3>
          <LikeButton gameId={id} initialLikes={likes_count} />
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">
          {description}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
              >
                #{tag}
              </span>
            ))}
            {extraCount > 0 && (
              <span className={cn("rounded-full bg-bg-surface px-2 py-0.5 text-[11px] text-text-muted")}>
                +{extraCount}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
