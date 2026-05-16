import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { closetItems } from "@/lib/closet";

const BodySchema = z.object({
  itemIds: z.array(z.string()).min(1).max(6),
  eventContext: z.string().max(500).optional(),
});

// Map item id -> filename in src/assets
const idToAsset: Record<string, string> = {
  coat: "item-coat.jpg",
  dress: "item-dress.jpg",
  sneaker: "item-sneaker.jpg",
  knit: "item-knit.jpg",
  denim: "item-denim.jpg",
  shirt: "item-shirt.jpg",
  blazer: "item-blazer.jpg",
  trousers: "item-trousers.jpg",
  boot: "item-boot.jpg",
};

async function fileToDataUrl(filename: string): Promise<string> {
  const full = path.join(process.cwd(), "src", "assets", filename);
  const buf = await readFile(full);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export const Route = createFileRoute("/api/tryon")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const validItems = body.itemIds
          .map((id) => closetItems.find((c) => c.id === id))
          .filter((i): i is NonNullable<typeof i> => Boolean(i));
        if (validItems.length === 0) {
          return new Response("No valid items", { status: 400 });
        }

        const avatarDataUrl = await fileToDataUrl("avatar.jpg");
        const itemDataUrls = await Promise.all(
          validItems.map((i) => fileToDataUrl(idToAsset[i.id])),
        );

        const itemList = validItems.map((i) => `${i.name} (${i.detail})`).join(", ");
        const prompt = `Editorial full-body fashion photograph of the woman in the first reference photo, wearing this complete outfit composed from the following reference garments: ${itemList}. Faithfully preserve her face, hair, and identity from the first image. Studio lighting on a soft neutral gradient backdrop, high fashion magazine style, sharp focus, elegant pose. ${body.eventContext ? `Styled for: ${body.eventContext}.` : ""}`;

        const content = [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: avatarDataUrl } },
          ...itemDataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
        ];

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          return new Response(`AI gateway error: ${errText}`, { status: aiRes.status });
        }

        const data = (await aiRes.json()) as {
          choices?: Array<{
            message?: {
              images?: Array<{ image_url?: { url?: string } }>;
            };
          }>;
        };
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!imageUrl) {
          return new Response("No image returned", { status: 502 });
        }

        return Response.json({ imageUrl });
      },
    },
  },
});
