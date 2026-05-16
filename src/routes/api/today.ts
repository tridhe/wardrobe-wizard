import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { loadFullCatalog, formatCatalogForPrompt, type CatalogEntry } from "@/lib/closet.server";

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface PlannedEvent {
  id: string;
  summary: string;
  location?: string;
  start: string | null;
  end: string | null;
  variants: OutfitVariant[];
}

interface OutfitVariant {
  id: string;
  label: string;
  rationale: string;
  outfitIds: string[];
}

async function checkGoogleCalendar(googleToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
    {
      headers: { Authorization: `Bearer ${googleToken}` },
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar error [${res.status}]: ${err}`);
  }
  return res.json();
}

function parseVariants(text: string, validIds: Set<string>): OutfitVariant[] {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        variants?: Array<{
          label?: string;
          rationale?: string;
          outfit?: string[];
        }>;
      };
      const variants = (parsed.variants ?? [])
        .map((variant, index) => {
          const ids = (variant.outfit ?? [])
            .map((s) => String(s).trim())
            .filter((s) => validIds.has(s));
          return {
            id: `variant-${index + 1}`,
            label: variant.label?.trim() || `Option ${index + 1}`,
            rationale: variant.rationale?.trim() ?? "",
            outfitIds: ids,
          };
        })
        .filter((variant) => variant.outfitIds.length > 0)
        .slice(0, 3);
      if (variants.length) return variants;
    } catch {
      /* ignore */
    }
  }
  return [
    {
      id: "variant-1",
      label: "Option 1",
      rationale: text.trim().slice(0, 280),
      outfitIds: [],
    },
  ];
}

async function fetchTodaysEvents(googleToken: string): Promise<GCalEvent[]> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "10",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${googleToken}` } },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar error [${res.status}]: ${err}`);
  }
  const data = (await res.json()) as { items?: GCalEvent[] };
  return data.items ?? [];
}

async function planOutfit(openAiKey: string, event: GCalEvent, catalog: CatalogEntry[]) {
  const when = event.start?.dateTime ?? event.start?.date ?? "";
  const userPrompt = `Event: ${event.summary ?? "Untitled"}
When: ${when}
Location: ${event.location ?? "—"}
Notes: ${event.description ?? "—"}

Pick THREE distinct outfit variants from the closet for this event.

Closet:
${formatCatalogForPrompt(catalog)}

Respond with ONLY a JSON object:
{"variants":[{"label":"Polished","rationale":"1 short sentence","outfit":["id1","id2","id3"]},{"label":"Relaxed","rationale":"1 short sentence","outfit":["id4","id5"]},{"label":"Statement","rationale":"1 short sentence","outfit":["id1","id6","id7"]}]}

Each variant should use 1-6 ids. A dress can stand in for top plus bottom. Only ids from the closet list.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are Aura, an expert personal stylist. Respond with strict JSON only.",
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI gateway error [${res.status}]: ${await res.text()}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseVariants(text, new Set(catalog.map((c) => c.id)));
}

export const Route = createFileRoute("/api/today")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { providerToken?: string; checkOnly?: boolean };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const googleToken = body.providerToken;
        if (!googleToken) {
          return new Response("Missing Google access token. Please sign in again.", {
            status: 401,
          });
        }

        try {
          if (body.checkOnly) {
            await checkGoogleCalendar(googleToken);
            return Response.json({ ok: true });
          }

          const openAiKey = process.env.OPENAI_API_KEY;
          if (!openAiKey) return new Response("Missing OPENAI_API_KEY", { status: 500 });

          const [events, { catalog }] = await Promise.all([
            fetchTodaysEvents(googleToken),
            loadFullCatalog(),
          ]);
          const planned: PlannedEvent[] = await Promise.all(
            events.map(async (ev) => {
              const variants = await planOutfit(openAiKey, ev, catalog);
              return {
                id: ev.id,
                summary: ev.summary ?? "Untitled event",
                location: ev.location,
                start: ev.start?.dateTime ?? ev.start?.date ?? null,
                end: ev.end?.dateTime ?? ev.end?.date ?? null,
                variants,
              };
            }),
          );
          return Response.json({ events: planned });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
