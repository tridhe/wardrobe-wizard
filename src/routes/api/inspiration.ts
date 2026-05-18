import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";
import { loadFullCatalog, formatCatalogForPrompt, type CatalogEntry } from "@/lib/closet.server";
import type { ClosetTags } from "@/lib/closet";

const ClientClosetItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(120),
  category: z.string().max(80),
  detail: z.string().max(240).optional(),
  imageUrl: z.string().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
});

const BodySchema = z.object({
  images: z.array(z.string().startsWith("data:image/")).min(1).max(4),
  closet: z.array(ClientClosetItemSchema).max(80).optional(),
});

export type InspirationMatch = {
  itemId: string;
  reason: string;
};

export type InspirationResult = {
  summary: string;
  vibe: string;
  detectedPieces: Array<{
    category: string;
    color: string;
    garmentType: string;
    notes: string;
  }>;
  matches: InspirationMatch[];
  missingPieces: string[];
  stylingAdvice: string;
};

function fallbackResult(): InspirationResult {
  return {
    summary: "Could not extract the inspiration outfit.",
    vibe: "",
    detectedPieces: [],
    matches: [],
    missingPieces: [],
    stylingAdvice: "",
  };
}

function toText(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function compactTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function colorFamily(value: string) {
  const text = value.toLowerCase();
  const families: Record<string, string[]> = {
    black: ["black", "charcoal", "ebony"],
    white: ["white", "ivory", "cream", "ecru", "off-white"],
    gray: ["gray", "grey", "silver", "slate"],
    blue: ["blue", "navy", "denim", "indigo", "cyan"],
    green: ["green", "olive", "sage", "khaki"],
    brown: ["brown", "tan", "camel", "beige", "taupe", "chocolate"],
    red: ["red", "burgundy", "maroon", "wine"],
    pink: ["pink", "rose", "blush"],
    purple: ["purple", "lavender", "lilac"],
    yellow: ["yellow", "mustard", "gold"],
    orange: ["orange", "rust", "terracotta"],
  };

  return Object.entries(families).find(([, words]) =>
    words.some((word) => text.includes(word)),
  )?.[0];
}

function categoryFamily(piece: InspirationResult["detectedPieces"][number]) {
  const text = [piece.category, piece.garmentType, piece.notes].join(" ").toLowerCase();
  if (/dress|gown/.test(text)) return "Dresses";
  if (/shoe|sneaker|boot|loafer|sandal|heel|flat|mule/.test(text)) return "Shoes";
  if (/coat|jacket|blazer|cardigan|outerwear|trench|parka/.test(text)) return "Outerwear";
  if (/jean|trouser|pant|skirt|short|legging|bottom/.test(text)) return "Bottoms";
  return "Tops";
}

function garmentFamily(value: string) {
  const text = value.toLowerCase();
  const families: Record<string, RegExp> = {
    tshirt: /\b(t-?shirt|tee)\b/,
    shirt: /\b(button[-\s]?down|shirt|blouse|oxford)\b/,
    sweater: /\b(sweater|knit|jumper|pullover)\b/,
    hoodie: /\b(hoodie|sweatshirt)\b/,
    tank: /\b(tank|camisole|cami)\b/,
    jeans: /\b(jean|denim)\b/,
    trousers: /\b(trouser|pant|chino|slack)\b/,
    skirt: /\bskirt\b/,
    shorts: /\bshorts?\b/,
    dress: /\bdress\b/,
    blazer: /\bblazer\b/,
    jacket: /\b(jacket|bomber|shacket)\b/,
    coat: /\b(coat|trench|parka)\b/,
    cardigan: /\bcardigan\b/,
    sneakers: /\b(sneaker|trainer)\b/,
    boots: /\bboots?\b/,
    sandals: /\bsandals?\b/,
    loafers: /\bloafers?\b/,
    heels: /\bheels?\b/,
  };

  return Object.entries(families).find(([, pattern]) => pattern.test(text))?.[0];
}

function itemText(item: CatalogEntry) {
  const tags = item.tags;
  return [
    item.name,
    item.category,
    item.detail,
    tags.color,
    tags.garmentType,
    tags.fit,
    tags.material,
    tags.pattern,
    tags.silhouette,
    tags.formality,
    ...(tags.season ?? []),
    ...(tags.occasions ?? []),
    ...(tags.styleTags ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function itemScore(piece: InspirationResult["detectedPieces"][number], item: CatalogEntry) {
  const pieceText = [piece.category, piece.color, piece.garmentType, piece.notes].join(" ");
  const closetText = itemText(item);
  const pieceFamily = garmentFamily(pieceText);
  const closetFamily = garmentFamily(closetText);
  const pieceColor = colorFamily(piece.color || pieceText);
  const closetColor = colorFamily([item.tags.color, closetText].join(" "));
  let score = 0;

  if (item.category === categoryFamily(piece)) score += 5;
  if (pieceFamily && closetFamily && pieceFamily === closetFamily) score += 5;
  if (pieceColor && closetColor && pieceColor === closetColor) score += 4;
  if (piece.color && closetText.toLowerCase().includes(piece.color.toLowerCase())) score += 2;

  const closetTokens = new Set(compactTokens(closetText));
  const sharedTokens = compactTokens([piece.garmentType, piece.notes].join(" ")).filter((token) =>
    closetTokens.has(token),
  );
  score += Math.min(sharedTokens.length, 4);

  return score;
}

function looseMatches(result: InspirationResult, catalog: CatalogEntry[], usedIds: Set<string>) {
  const additions: InspirationMatch[] = [];

  for (const piece of result.detectedPieces) {
    const best = catalog
      .filter((item) => !usedIds.has(item.id))
      .map((item) => ({ item, score: itemScore(piece, item) }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 5) continue;
    usedIds.add(best.item.id);
    additions.push({
      itemId: best.item.id,
      reason: `Similar enough: ${[piece.color, piece.garmentType || piece.category]
        .filter(Boolean)
        .join(
          " ",
        )} maps to this ${best.item.category.toLowerCase()} by broad category, color family, or garment type.`,
    });
  }

  return additions;
}

function normalizeResult(value: unknown, catalog: CatalogEntry[]): InspirationResult {
  const fallback = fallbackResult();
  const validIds = new Set(catalog.map((item) => item.id));
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<InspirationResult>;
  const result = {
    summary: String(parsed.summary ?? fallback.summary),
    vibe: String(parsed.vibe ?? ""),
    detectedPieces: Array.isArray(parsed.detectedPieces) ? parsed.detectedPieces.slice(0, 8) : [],
    matches: Array.isArray(parsed.matches)
      ? parsed.matches
          .map((match) => ({
            itemId: String(match.itemId ?? "").trim(),
            reason: String(match.reason ?? "").trim(),
          }))
          .filter((match) => validIds.has(match.itemId))
          .slice(0, 6)
      : [],
    missingPieces: Array.isArray(parsed.missingPieces)
      ? parsed.missingPieces.map(String).slice(0, 8)
      : [],
    stylingAdvice: String(parsed.stylingAdvice ?? ""),
  };
  const usedIds = new Set(result.matches.map((match) => match.itemId));
  return {
    ...result,
    matches: [...result.matches, ...looseMatches(result, catalog, usedIds)].slice(0, 8),
  };
}

function clientCatalog(body: z.infer<typeof BodySchema>): CatalogEntry[] | null {
  if (!body.closet?.length) return null;
  return body.closet.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    detail: item.detail ?? "",
    imageUrl: item.imageUrl ?? "",
    tags: (item.tags ?? {}) as ClosetTags,
    source: "user",
  }));
}

export const Route = createFileRoute("/api/inspiration")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });

        const catalog = clientCatalog(body) ?? (await loadFullCatalog()).catalog;
        if (catalog.length === 0) {
          return Response.json({
            ...fallbackResult(),
            summary: "Upload clothing to your Closet before matching inspiration looks.",
          });
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
                  "You analyze fashion inspiration images and match them to a user's existing closet. Respond with strict JSON only.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyze these inspiration images. Extract a SIMPLE, broad version of the outfit pieces before matching. Avoid overly specific requirements.

Then compare against this closet catalog and select the closest matching user-owned items. Use only valid item ids from the catalog.

Closet:
${formatCatalogForPrompt(catalog)}

Return ONLY JSON:
{
  "summary": "one sentence describing the inspiration look",
  "vibe": "short style vibe",
  "detectedPieces": [
    {"category":"Tops","color":"white","garmentType":"button-down shirt","notes":"oversized and crisp"}
  ],
  "matches": [
    {"itemId":"valid-id-from-closet","reason":"why this closet item matches the inspiration"}
  ],
  "missingPieces": ["items or details the closet does not seem to have"],
  "stylingAdvice": "how to style the matched items to get close to the inspiration"
}

Matching rules:
- Prefer broad similarity over exact description. A white shirt can match an ivory blouse; navy denim can match blue jeans; a blazer can match a structured jacket.
- Match by category first, then color family, garment family, silhouette, formality, and vibe.
- Do not reject a useful match only because fabric, sleeve length, neckline, pattern scale, brand, or styling details differ.
- Pick the closest owned substitute when it would help recreate the look. Put only truly absent categories in missingPieces.`,
                  },
                  ...body.images.map((url) => ({ type: "image_url", image_url: { url } })),
                ],
              },
            ],
          }),
        });

        if (!res.ok) {
          return new Response(`OpenAI inspiration error: ${await res.text()}`, {
            status: res.status,
          });
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "{}";
        try {
          return Response.json(normalizeResult(JSON.parse(text), catalog));
        } catch {
          return Response.json(fallbackResult());
        }
      },
    },
  },
});
