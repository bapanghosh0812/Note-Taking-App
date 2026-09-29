/**
 * Crops a picked photo to a centred square and scales it to 256×256 in the
 * browser, so we upload ~20 KB instead of a multi-megabyte camera file.
 * Re-encoding through <canvas> also strips EXIF metadata such as GPS location.
 */
const SIZE = 256;

export async function prepareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is larger than 15 MB.");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This image format isn’t supported. Try a JPEG or PNG.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.86);
  // Browsers without WebP encoding silently return PNG; fall back to JPEG instead.
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg", 0.88);
  if (!blob) throw new Error("Couldn’t process that photo.");
  return blob;
}

export async function uploadAvatar(blob: Blob): Promise<string | null> {
  const res = await fetch("/api/account/avatar", { method: "PUT", headers: { "content-type": blob.type }, body: blob });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed.");
  return body.avatarUrl as string | null;
}
