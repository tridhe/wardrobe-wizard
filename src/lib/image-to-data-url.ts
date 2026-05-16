// Browser-side: fetch an image URL and return a resized JPEG data URL.
// Resizing keeps the request well under the gateway's 32k input-token limit.
export async function imageToDataUrl(url: string, maxDim = 768): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const blob = await res.blob();
  if (blob.type.startsWith("text/")) {
    throw new Error(`Expected image but got ${blob.type} for ${url}`);
  }

  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", 0.75);
}
