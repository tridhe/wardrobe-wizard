import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
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

export const Route = createFileRoute("/api/tryon")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const base = new URL(request.url);
        const resolve = (u: string) =>
          u.startsWith("data:") ? u : new URL(u, base).toString();

        // Cap outfit pieces to keep token budget under the model's 32k limit.
        const items = body.items.slice(0, 4);
        const avatarUrl = resolve(body.avatarUrl);
        const itemUrls = items.map((i) => resolve(i.imageUrl));

        const itemList = items
          .map((i) => `${i.name}${i.detail ? ` (${i.detail})` : ""}`)
          .join(", ");
        const prompt = `Editorial full-body fashion photograph of the woman in the first reference photo, wearing this complete outfit composed from the following reference garments: ${itemList}. Faithfully preserve her face, hair, and identity from the first image. Studio lighting on a soft neutral gradient backdrop, high fashion magazine style, sharp focus, elegant pose. ${body.eventContext ? `Styled for: ${body.eventContext}.` : ""}`;

        // Pass image URLs directly — the gateway fetches them, avoiding the
        // huge base64 token cost that triggers INVALID_ARGUMENT (32k limit).
        const content = [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: avatarUrl } },
          ...itemUrls.map((url) => ({ type: "image_url", image_url: { url } })),
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
