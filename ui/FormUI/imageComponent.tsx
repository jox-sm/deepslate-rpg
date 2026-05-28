"use client";

import { useRef, useState, useEffect, useCallback } from "react";

import { ImageUploadProps } from "@/types/form";
import formStyles from "@/styles/forms/form.module.css";

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

  function handleFile(file: File) {
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
    onSelect(file);
    onPreviewChange?.(imageUrl);
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={inputIdRef.current} className="text-sm font-medium">{label}</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={formStyles.button}
        aria-label={`Upload ${label}`}
      >
        {preview ? (
          <img
          src={preview}
          alt="Preview"
          className={formStyles.previewImage}
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
        className={formStyles.hiddenInput}
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          handleFile(file);
        }}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}