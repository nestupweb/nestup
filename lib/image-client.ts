/**
 * Browser-side image preparation for uploads. Phones hand us 4–12 MB HEIC/JPEG
 * files; we re-encode to a ≤1600px JPEG (~150–400 KB) before they leave the
 * device, which also turns HEIC into something every browser can show.
 */
export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.84;

/** Apple's camera format. Safari decodes it; nothing else does. */
export const isHeic = (file: File) => /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/** Decode with what the browser has built in. */
async function decodeNative(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decoding (older Safari, some HEIC paths) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("This image format isn't supported — please use JPG, PNG or WebP."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Last resort for an iPhone photo: decode the HEIC ourselves.
 *
 * Imported here rather than at the top of the file on purpose — it is ~1.3 MB
 * of wasm, and it is only ever fetched when someone actually picks a HEIC on a
 * browser that cannot read one. Safari decodes HEIC natively, so it never
 * reaches this; sending from a phone never reaches it either. It exists for the
 * desktop case, where the photo used to upload as an unviewable .heic and land
 * in the thread as a download link.
 */
async function decodeHeic(file: File): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: JPEG_QUALITY });
  return Array.isArray(out) ? out[0] : out; // a live photo / burst decodes to several frames
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await decodeNative(file);
  } catch (err) {
    if (!isHeic(file)) throw err;
    return decodeNative(await decodeHeic(file));
  }
}

/** Re-encode `file` as a downscaled JPEG. Returns the original when it's already small and web-friendly. */
export async function compressImage(file: File): Promise<Blob> {
  const webFriendly = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (webFriendly && file.size <= 400 * 1024) return file;
  if (typeof document === "undefined") return file;

  const source = await decode(file);
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Could not process this image — please try another file.");
  return blob;
}
