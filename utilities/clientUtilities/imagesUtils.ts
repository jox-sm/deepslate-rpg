
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Build a data URL from an ArrayBuffer.
 *
 * Used for image PREVIEWS instead of `URL.createObjectURL()`. An object URL
 * is tied to the lifetime of the DOM node that created it - when a wizard
 * step unmounts, the URL is revoked and the preview is gone. A data URL is a
 * plain string, so it survives remounts, survives a page reload, and can be
 * persisted to localStorage.
 */
export function bufferToDataUrl(buffer: ArrayBuffer, mimeType = "image/webp"): string {
  const bytes = new Uint8Array(buffer);
  // Chunked so we never blow the argument limit of String.fromCharCode.apply
  // on a multi-megabyte image.
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * Rebuild an ArrayBuffer from a data URL (or a raw base64 string).
 * Returns null when the input is not usable.
 */
export function dataUrlToBuffer(dataUrl: string): ArrayBuffer | null {
  if (!dataUrl) return null;
  try {
    const base64 = dataUrl.startsWith("data:") ? dataUrl.split(",")[1] ?? "" : dataUrl;
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}
