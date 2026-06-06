'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { CardProps } from "@/types/cards";
import { useGamePreloadStore } from "@/utilities/clientUtilities/useGameCache";
import { cn } from "@/lib/utils";
import { FittedImage } from "@/components/shared/FittedImage";
import LikeButton from "@/components/adventures/cards/like-button";
import styles from "@/styles/cards/cards.module.css";

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
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    posthog.capture('adventure_card_viewed', { name, tags });
  }, [name, tagsKey]);

  const handleClick = () => {
    setPreload(id, { name, description, image, tags, likes_count });
    posthog.capture('adventure_card_clicked', { id, name, tags: tagsKey });
    router.push(`/game/${id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(styles.card)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
    >
      <div className={styles.imagecontainer}>
        <FittedImage
          src={imageError ? '/images/project.jpg' : image}
          alt={name}
          aspectRatio="3/2"
          className="transition-transform duration-500 ease-ember"
          showOverlay
        />
      </div>
      <div className={styles.nameSection}>
        <h3 className={cn(styles.name, "line-clamp-1")}>{name}</h3>
        <div className="mt-1">
          <LikeButton gameId={id} initialLikes={likes_count} />
        </div>
      </div>
      {tags.length > 0 && (
        <div className={styles.tagsSection}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tagPill}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
