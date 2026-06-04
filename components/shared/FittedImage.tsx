import Image from "next/image";
import { cn } from "@/lib/utils";
import styles from "@/styles/shared/fitted-image.module.css";

interface FittedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  fit?: "cover" | "contain" | "fill";
  priority?: boolean;
  quality?: number;
  showOverlay?: boolean;
}

export function FittedImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = "4/3",
  fit = "cover",
  priority = false,
  quality = 85,
  showOverlay = false,
}: FittedImageProps) {
  const fitClass = fit === "cover" ? styles.cover : fit === "contain" ? styles.contain : styles.fill;

  return (
    <div
      className={cn(styles.wrapper, containerClassName)}
      style={{ aspectRatio }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={cn(fitClass, className)}
        priority={priority}
        quality={quality}
      />
      {showOverlay && <div className={styles.overlay} />}
    </div>
  );
}
