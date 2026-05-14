"use client";

import { useRef, useState } from "react";

import { ImageUploadProps } from "@/types/form";
import formStyles from "@/styles/forms/form.module.css";

export default function ImageUpload({
  label,
  onSelect,
  onPreviewChange,
  accept = "image/*",
  maxSizeMB = 3,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

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
    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);
    onSelect(file);
    onPreviewChange?.(imageUrl);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium">{label}</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={formStyles.button}
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
        type="file"
        accept={accept}
        className={formStyles.hiddenInput}
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