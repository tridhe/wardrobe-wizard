import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { fal } from "@fal-ai/client";
import { z } from "zod";

const imageRef = z
  .string()
  .min(1)
  .refine(
    (s) => s.startsWith("data:image/") || /^https?:\/\//.test(s) || s.startsWith("/"),
    "Must be a data URL, absolute URL, or root-relative path",
  );

const BodySchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        detail: z.string().max(200).default(""),
        imageUrl: imageRef,
      }),
    )
    .min(1)
    .max(6),
  avatarUrl: imageRef,
  eventContext: z.string().max(500).optional(),
});

function dataUrlToBlob(dataUrl: string): { blob: Blob; extension: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    throw new Error("Image edits require data URL image inputs");
  }
  const mimeType = match[1];
  const base64 = match[2];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return { blob: new Blob([bytes], { type: mimeType }), extension };
}

async function imageRefToFalUrl(imageRef: string, requestUrl: string) {
  if (imageRef.startsWith("data:image/")) {
    const { blob } = dataUrlToBlob(imageRef);
    return fal.storage.upload(blob);
  }

  const url = imageRef.startsWith("/") ? new URL(imageRef, requestUrl).toString() : imageRef;
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    return url;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read local image: ${res.status}`);
  return fal.storage.upload(await res.blob());
}

export const Route = createFileRoute("/api/tryon")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
        if (!key) return new Response("Missing FAL_KEY", { status: 500 });
        fal.config({ credentials: key });

        const items = body.items.slice(0, 6);

        const garmentInstructions = items
          .map((item, index) => {
            const imageRef = `@image${index + 2}`;
            const detail = item.detail ? ` (${item.detail})` : "";
            return `wear the ${item.name}${detail} from ${imageRef}`;
          })
          .join(", ");
        const prompt = `Please make this person @image1 ${garmentInstructions}. Preserve the person's face, hair, identity, body shape, and pose as much as possible from @image1. Preserve the garment colors, silhouettes, patterns, logos, and fabric details from their referenced images. Make it look like a realistic full-body fashion photograph with natural fit and drape, studio lighting, and a soft neutral backdrop. ${body.eventContext ? `Style it for: ${body.eventContext}.` : ""}`;

        try {
          const imageUrls = await Promise.all([
            imageRefToFalUrl(body.avatarUrl, request.url),
            ...items.map((item) => imageRefToFalUrl(item.imageUrl, request.url)),
          ]);

          const result = await fal.subscribe("fal-ai/flux-2-pro/edit", {
            input: {
              prompt,
              image_urls: imageUrls,
              image_size: "portrait_4_3",
              output_format: "png",
              sync_mode: true,
            },
            logs: false,
          });

          const data = result.data as {
            images?: Array<{ url?: string }>;
          };
          const imageUrl = data.images?.[0]?.url;
          if (!imageUrl) {
            return new Response("No image returned", { status: 502 });
          }

          return Response.json({ imageUrl });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown fal error";
          return new Response(`fal gateway error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
