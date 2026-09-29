/**
 * Identifies an uploaded image by its first bytes ("magic numbers") instead of
 * trusting the file name or Content-Type header. Only raster formats are
 * allowed — never SVG, which can contain scripts.
 */
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function detectImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export const AVATAR_MAX_BYTES = 100 * 1024;

export function avatarUrl(updatedAt: Date | null | undefined) {
  return updatedAt ? `/api/account/avatar?v=${updatedAt.getTime()}` : null;
}
