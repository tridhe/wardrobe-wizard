import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";
import { type ClosetCategory, type ClosetTags } from "@/lib/closet";

const categories = ["Tops", "Bottoms", "Dresses", "Shoes", "Outerwear"] as const;

const BodySchema = z.object({
  imageUrl: z.string().startsWith("data:image/"),
  category: z.enum(categories).optional(),
  color: z.string().max(80).optional(),
  garmentType: z.string().max(120).optional(),
});

type TagResult = {
  category: ClosetCategory;
  color: string;
  garmentType: string;
  fit: string;
  material: string;
  pattern: string;
  silhouette: string;
  formality: string;
  season: string[];
  occasions: string[];
  styleTags: string[];
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
}

function fallbackTags(body: z.infer<typeof BodySchema>): TagResult {
  return {
    category: body.category ?? "Tops",
    color: body.color?.trim() || "Unknown color",
    garmentType: body.garmentType?.trim() || "Clothing item",
    fit: "",
    material: "",
    pattern: "",
    silhouette: "",
    formality: "",
    season: [],
    occasions: [],
    styleTags: [],
  };
}

function normalizeTags(value: unknown, body: z.infer<typeof BodySchema>): TagResult {
  const fallback = fallbackTags(body);
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<TagResult>;
  const tags = parsed as Partial<ClosetTags>;
  return {
    category:
      body.category ??
      (categories.includes(parsed.category as ClosetCategory)
        ? parsed.category!
        : fallback.category),
    color: body.color?.trim() || parsed.color?.trim() || fallback.color,
    garmentType: body.garmentType?.trim() || parsed.garmentType?.trim() || fallback.garmentType,
    fit: tags.fit?.trim() || fallback.fit,
    material: tags.material?.trim() || fallback.material,
    pattern: tags.pattern?.trim() || fallback.pattern,
    silhouette: tags.silhouette?.trim() || fallback.silhouette,
    formality: tags.formality?.trim() || fallback.formality,
    season: stringArray(tags.season),
    occasions: stringArray(tags.occasions),
    styleTags: stringArray(tags.styleTags),
  };
}

export const Route = createFileRoute("/api/tag-item")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const existing = fallbackTags(body);
        const hasBasicTags = body.category && body.color?.trim() && body.garmentType?.trim();
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
          if (hasBasicTags) return Response.json(existing);
          return new Response("Missing OPENAI_API_KEY", { status: 500 });
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model:
              process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You tag clothing photos for a wardrobe app. Respond with strict JSON only.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Infer missing metadata for this clothing item.

Allowed category values: Tops, Bottoms, Dresses, Shoes, Outerwear.
Existing user inputs:
- category: ${body.category ?? ""}
- color: ${body.color ?? ""}
- garmentType: ${body.garmentType ?? ""}

Return ONLY JSON like:
{"category":"Tops","color":"white","garmentType":"t-shirt","fit":"relaxed","material":"cotton jersey","pattern":"solid","silhouette":"crew neck short sleeve","formality":"casual","season":["spring","summer"],"occasions":["weekend","travel"],"styleTags":["minimal","basic","streetwear"]}

If category, color, or garmentType user input is already present, preserve it exactly. Use concise everyday garment types such as t-shirt, shirt, jeans, trousers, skirt, sneaker, boot, jacket, blazer, coat, dress, sweater, hoodie. Keep arrays short and practical.`,
                  },
                  { type: "image_url", image_url: { url: body.imageUrl } },
                ],
              },
            ],
          }),
        });

        if (!res.ok) {
          return new Response(`OpenAI tagging error: ${await res.text()}`, {
            status: res.status,
          });
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "{}";
        try {
          return Response.json(normalizeTags(JSON.parse(text), body));
        } catch {
          return Response.json(existing);
        }
      },
    },
  },
});
