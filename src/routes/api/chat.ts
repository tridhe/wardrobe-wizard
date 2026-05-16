import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { loadFullCatalog, formatCatalogForPrompt } from "@/lib/closet.server";

type ChatRequestBody = { messages?: unknown };

function buildSystem(catalogText: string): string {
  return `You are "Atelier", a warm, expert personal stylist with access to the user's digital closet.

The user will tell you about an event or occasion they're attending. Your job:
1. Ask a brief clarifying question if needed (weather, vibe, dress code) — but only one short question.
2. Then propose ONE complete outfit using ONLY items from the closet below.
3. When you propose the final outfit, you MUST end your reply with a single line in this exact format (no markdown, no extra text after it):
OUTFIT: id1, id2, id3

Use 2–4 item ids. Use only valid ids from this catalog:
${catalogText}

Be concise, evocative, and editorial in tone. Reference textures and silhouettes. Don't list bullet points — write 2–4 short sentences explaining the look before the OUTFIT line.`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");
        const result = streamText({
          model,
          system: SYSTEM,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages as UIMessage[] });
      },
    },
  },
});
