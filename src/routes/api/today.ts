import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { loadFullCatalog, formatCatalogForPrompt, type CatalogEntry } from "@/lib/closet.server";

const CALENDAR_GATEWAY =
  "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

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

function parseOutfit(
  text: string,
  validIds: Set<string>,
): { rationale: string; ids: string[] } {
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
      if (ids.length) {
        return { rationale: parsed.rationale?.trim() ?? "", ids };
      }
    } catch {
      // fall through
    }
  }
  return { rationale: text.trim().slice(0, 280), ids: [] };
}

async function fetchTodaysEvents(
  lovableKey: string,
  connKey: string,
): Promise<GCalEvent[]> {
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
    `${CALENDAR_GATEWAY}/calendars/primary/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
      },
    },
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
): Promise<{ rationale: string; ids: string[] }> {
  const when = event.start?.dateTime ?? event.start?.date ?? "";
  const userPrompt = `Event: ${event.summary ?? "Untitled"}
When: ${when}
Location: ${event.location ?? "—"}
Notes: ${event.description ?? "—"}

Pick ONE outfit from the closet for this event.

Closet:
${formatCatalogForPrompt(catalog)}

Respond with ONLY a JSON object, no markdown, in this exact shape:
{"rationale": "1-2 sentences explaining the look", "outfit": ["id1", "id2", "id3"]}
Use 2-4 ids. Only use ids that appear in the closet list above.`;

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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI gateway error [${res.status}]: ${err}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const validIds = new Set(catalog.map((c) => c.id));
  return parseOutfit(text, validIds);
}

export const Route = createFileRoute("/api/today")({
  server: {
    handlers: {
      GET: async () => {
        const lovableKey = process.env.LOVABLE_API_KEY;
        const connKey = process.env.GOOGLE_CALENDAR_API_KEY;
        if (!lovableKey) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }
        if (!connKey) {
          return new Response("Google Calendar not connected", { status: 500 });
        }

        try {
          const events = await fetchTodaysEvents(lovableKey, connKey);
          const planned: PlannedEvent[] = await Promise.all(
            events.map(async (ev) => {
              const { rationale, ids } = await planOutfit(lovableKey, ev);
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
