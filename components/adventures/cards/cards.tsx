'use client';
import { useEffect } from "react";
import style from "@/styles/cards/cards.module.css";
import posthog from "posthog-js";
import { CardProps } from "@/types/cards";

export default function ProfileCard({
  image,
  name,
  description,
  tags,
}: CardProps) {
  const tagsKey = tags.join(',');
  useEffect(() => {
    posthog.capture('adventure_card_viewed', { name, tags });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, tagsKey]);
  return (
    <div className={style.card}>
      {/* Photo Layout */}
      <div className={style.imagecontainer}>
        <img
          src={image}
          alt={name}
          className={style.img}
        />
      </div>

      {/* Content */}
      <div className={style.contentPadding}>
        {/* Name */}
        <h2 className={style.header}>{name}</h2>

        {/* Description */}
        <p className={style.content}>
          {description}
        </p>

         {/* Tags */}
         <div className={style.tags}>
           {tags.map((tag) => (
             <span
               key={tag}
               className={style.tagPill}
             >
               #{tag}
             </span>
           ))}
         </div>
      </div>
    </div>
  );
}