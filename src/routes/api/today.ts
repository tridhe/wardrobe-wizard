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
  rationale: string;
  outfitIds: string[];
}

function parseOutfit(text: string, validIds: Set<string>) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        rationale?: string;
        outfit?: string[];
      };
      const ids = (parsed.outfit ?? [])
        .map((s) => String(s).trim())
        .filter((s) => validIds.has(s));
      if (ids.length) return { rationale: parsed.rationale?.trim() ?? "", ids };
    } catch {
      /* ignore */
    }
  }
  return { rationale: text.trim().slice(0, 280), ids: [] };
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

async function planOutfit(
  lovableKey: string,
  event: GCalEvent,
  catalog: CatalogEntry[],
) {
  const when = event.start?.dateTime ?? event.start?.date ?? "";
  const userPrompt = `Event: ${event.summary ?? "Untitled"}
When: ${when}
Location: ${event.location ?? "—"}
Notes: ${event.description ?? "—"}

Pick ONE outfit from the closet for this event.

Closet:
${formatCatalogForPrompt(catalog)}

Respond with ONLY a JSON object: {"rationale": "1-2 sentences", "outfit": ["id1","id2","id3"]}
Use 2-4 ids. Only ids from the closet list.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are Atelier, an expert personal stylist. Respond with strict JSON only.",
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
  return parseOutfit(text, new Set(catalog.map((c) => c.id)));
}

export const Route = createFileRoute("/api/today")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: { providerToken?: string };
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
          const [events, { catalog }] = await Promise.all([
            fetchTodaysEvents(googleToken),
            loadFullCatalog(),
          ]);
          const planned: PlannedEvent[] = await Promise.all(
            events.map(async (ev) => {
              const { rationale, ids } = await planOutfit(lovableKey, ev, catalog);
              return {
                id: ev.id,
                summary: ev.summary ?? "Untitled event",
                location: ev.location,
                start: ev.start?.dateTime ?? ev.start?.date ?? null,
                end: ev.end?.dateTime ?? ev.end?.date ?? null,
                rationale,
                outfitIds: ids,
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
