'use client';
import { useEffect, useState } from "react";
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
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    posthog.capture('adventure_card_viewed', { name, tags });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, tagsKey]);

  const handleImageError = () => {
    setImageError(true);
    // TODO: Call an API endpoint to report broken image and invalidate cache for this game/item
    // Example: fetch(`/api/report-broken-image?imageUrl=${encodeURIComponent(image)}`, { method: 'POST' });
    console.error(`Image failed to load: ${image}`);
  };

  return (
    <div className={style.card}>
      {/* Photo Layout */}
      <div className={style.imagecontainer}>
        <img
          src={imageError ? '/images/project.jpg' : image}
          alt={name}
          onError={handleImageError}
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
               >
               #{tag}
             </span>
           ))}
         </div>
       </div>
     </div>
   );
 }