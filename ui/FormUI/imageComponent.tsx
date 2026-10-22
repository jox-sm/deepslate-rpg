"use client";

import { useRef, useState, useId, useCallback } from "react";

import { ImageUploadProps } from "@/types/form";
import { bufferToDataUrl } from "@/utilities/clientUtilities/imagesUtils";

export default function ImageUpload({
  label,
  onSelect,
  onPreviewChange,
  value = null,
  accept = "image/*",
  maxSizeMB = 3,
  resetKey,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(value);
  const [error, setError] = useState("");

  // Restore a preview supplied by the parent (draft restore, or a step that
  // remounted after "back"). The previous version kept the preview in local
  // state only and used an object URL, which was revoked on unmount - so
  // navigating back to a step blanked the image.
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    setPreview(value);
  }

  // Render-time reset adjustment (React-endorsed alternative to syncing
  // state inside an effect).
  const [resetSeen, setResetSeen] = useState(resetKey);
  if (resetSeen !== resetKey) {
    setResetSeen(resetKey);
    setPreview(null);
    setError("");
  }

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("File must be an image.");
        return;
      }

      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`Image exceeds ${maxSizeMB}MB.`);
        return;
      }

      setError("");
      const buffer = await file.arrayBuffer();
      // A data URL (not an object URL) so the preview survives remounts,
      // reloads and localStorage persistence.
      const dataUrl = bufferToDataUrl(buffer, file.type);
      setPreview(dataUrl);
      onSelect(buffer);
      onPreviewChange?.(dataUrl);
    },
    [maxSizeMB, onPreviewChange, onSelect]
  );

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">{label}</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-24 w-full items-center justify-center rounded-[10px] border-2 border-dashed border-border bg-bg-elevated text-sm text-text-muted transition-colors hover:border-accent/50 hover:text-accent"
        aria-label={`Upload ${label}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview"
            className="h-full w-full rounded-[10px] object-cover"
          />
        ) : (
          <span>Upload Image</span>
        )}
      </button>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void handleFile(file);
          // Allow re-selecting the same file after a removal.
          e.target.value = "";
        }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
