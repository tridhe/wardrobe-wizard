import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { loadFullCatalog, formatCatalogForPrompt } from "@/lib/closet.server";

type ChatRequestBody = { messages?: unknown };

type PioneerExtraction = {
  content: string;
  raw: unknown;
};

function extractTextPart(part: unknown): string {
  if (!part || typeof part !== "object") return "";
  const candidate = part as { type?: unknown; text?: unknown };
  return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
}

function latestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;

    if (Array.isArray(message.parts)) {
      return message.parts.map(extractTextPart).filter(Boolean).join("\n").trim();
    }
  }
  return "";
}

function parsePioneerContent(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value.trim();
  }
}

async function extractStylingContext(userPrompt: string): Promise<PioneerExtraction | null> {
  const key = process.env.PIONEER_API_KEY ?? process.env.PIONEER_KEY;
  if (!key || !userPrompt.trim()) return null;

  const res = await fetch("https://api.pioneer.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.PIONEER_MODEL ?? "7771b6cb-5a50-48f2-9091-8e3580c81153",
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      schema: {
        entities: [
          "occasion",
          "event_type",
          "location",
          "venue",
          "date_time",
          "weather",
          "dress_code",
          "formality",
          "style_preference",
          "color",
          "garment",
          "avoidance",
        ],
      },
      include_confidence: true,
      include_spans: true,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = parsePioneerContent(data.choices?.[0]?.message?.content);
  return content ? { content, raw: data } : null;
}

function formatPioneerContext(extraction: PioneerExtraction | null): string {
  if (!extraction) return "";
  return `\n\nStructured styling context extracted from the latest user message by Pioneer. Treat this as helpful context, not as a replacement for the user's words. If it conflicts with the user's message, trust the user's message.\n${extraction.content}`;
}

function buildSystem(catalogText: string, pioneerContext: string): string {
  if (!catalogText.trim()) {
    return `You are "Aura", a warm, expert personal stylist.

The user's closet is empty. Tell them you need them to upload clothing in the Closet before you can generate an outfit. Do not invent item ids and do not include an OUTFIT line.${pioneerContext}`;
  }

  return `You are "Aura", a warm, expert personal stylist with access to the user's digital closet.

The user will tell you about an event or occasion they're attending. Your job:
1. Infer the event, vibe, weather hints, formality, and practical needs from the user's description.
2. Select ONE complete outfit using ONLY items from the closet below.
3. When you propose the final outfit, you MUST end your reply with a single line in this exact format (no markdown, no extra text after it):
OUTFIT: id1, id2, id3

Use 1-6 item ids. Choose compatible pieces across categories when available. A dress can stand in for top and bottom. Use only valid ids from this catalog:
${catalogText}

Be concise, evocative, and editorial in tone. Reference why the selected pieces fit the user's prompt. Don't list bullet points - write 2-4 short sentences explaining the look before the OUTFIT line.${pioneerContext}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const uiMessages = messages as UIMessage[];
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const [closet, pioneerExtraction] = await Promise.all([
          loadFullCatalog(),
          extractStylingContext(latestUserText(uiMessages)),
        ]);
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway(process.env.LOVABLE_CHAT_MODEL ?? "google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: buildSystem(
            formatCatalogForPrompt(closet.catalog),
            formatPioneerContext(pioneerExtraction),
          ),
          messages: await convertToModelMessages(uiMessages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: uiMessages });
      },
    },
  },
});
