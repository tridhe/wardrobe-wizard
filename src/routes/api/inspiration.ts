import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";
import { loadFullCatalog, formatCatalogForPrompt } from "@/lib/closet.server";

const BodySchema = z.object({
  images: z.array(z.string().startsWith("data:image/")).min(1).max(4),
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

function normalizeResult(value: unknown, validIds: Set<string>): InspirationResult {
  const fallback = fallbackResult();
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<InspirationResult>;
  return {
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
}

export const Route = createFileRoute("/api/inspiration")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });

        const { catalog } = await loadFullCatalog();
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
                    text: `Analyze these inspiration images. Extract the outfit pieces, colors, silhouette, vibe, and styling cues.

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

Prefer matching by category, color, garment type, silhouette, fabric, and vibe. If no close match exists for a piece, put it in missingPieces instead of forcing a bad match.`,
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
          return Response.json(
            normalizeResult(JSON.parse(text), new Set(catalog.map((i) => i.id))),
          );
        } catch {
          return Response.json(fallbackResult());
        }
      },
    },
  },
});
