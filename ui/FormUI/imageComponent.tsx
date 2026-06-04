"use client";

import { useRef, useState, useEffect, useCallback } from "react";

import { ImageUploadProps } from "@/types/form";

let imageInputIdCounter = 0;

export default function ImageUpload({
  label,
  onSelect,
  onPreviewChange,
  accept = "image/*",
  maxSizeMB = 3,
  resetKey,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputIdRef = useRef(`image-upload-${++imageInputIdCounter}`);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const prevPreviewRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (prevPreviewRef.current) {
      URL.revokeObjectURL(prevPreviewRef.current);
      prevPreviewRef.current = null;
    }
  }, []);

  useEffect(() => {
    revokePreview();
    setPreview(null);
    setError("");
  }, [resetKey, revokePreview]);

  useEffect(() => {
    return () => revokePreview();
  }, [revokePreview]);

  async function handleFile(file: File) {
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
    revokePreview();
    const imageUrl = URL.createObjectURL(file);
    prevPreviewRef.current = imageUrl;
    setPreview(imageUrl);
    const buffer = await file.arrayBuffer();
    onSelect(buffer);
    onPreviewChange?.(imageUrl);
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={inputIdRef.current} className="text-sm font-medium text-text-secondary">{label}</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-24 w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-bg-elevated text-sm text-text-muted transition-all duration-200 hover:border-accent/50 hover:text-accent"
        aria-label={`Upload ${label}`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="h-full w-full rounded-lg object-cover"
          />
        ) : (
          <span>Upload Image</span>
        )}
      </button>

      <input
        ref={inputRef}
        id={inputIdRef.current}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          handleFile(file);
        }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
