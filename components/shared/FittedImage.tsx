import Image from "next/image";
import { cn } from "@/lib/utils";

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
  const fitClass =
    fit === "cover"
      ? "object-cover"
      : fit === "contain"
        ? "object-contain"
        : "object-fill";

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-bg-surface", containerClassName)}
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
      {showOverlay && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
        />
      )}
    </div>
  );
}
