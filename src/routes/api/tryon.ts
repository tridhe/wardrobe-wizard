import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";

const BodySchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        detail: z.string().max(200).default(""),
        imageUrl: z.string().url(),
      }),
    )
    .min(1)
    .max(6),
  avatarUrl: z.string().url(),
  eventContext: z.string().max(500).optional(),
});

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  return `data:${contentType};base64,${b64}`;
}

export const Route = createFileRoute("/api/tryon")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Resolve all URLs against the incoming request so relative asset
        // URLs (e.g. /_build/assets/avatar.xxx.jpg) work in dev and prod.
        const base = new URL(request.url);
        const resolve = (u: string) => new URL(u, base).toString();

        const [avatarDataUrl, ...itemDataUrls] = await Promise.all([
          urlToDataUrl(resolve(body.avatarUrl)),
          ...body.items.map((i) => urlToDataUrl(resolve(i.imageUrl))),
        ]);

        const itemList = body.items
          .map((i) => `${i.name}${i.detail ? ` (${i.detail})` : ""}`)
          .join(", ");
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
