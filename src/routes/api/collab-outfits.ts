import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";

const ClosetItemSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  category: z.string().max(80).optional(),
  detail: z.string().max(240).optional(),
  tags: z.array(z.string().max(80)).max(16).optional(),
});

const PersonSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(80),
  interests: z.string().max(500).optional(),
  closet: z.array(ClosetItemSchema).max(30),
});

const BodySchema = z.object({
  viewerPersonId: z.string().min(1).max(120),
  eventName: z.string().max(160).optional(),
  eventType: z.string().max(120).optional(),
  location: z.string().max(180).optional(),
  dressCode: z.string().max(120).optional(),
  sharedVibe: z.string().max(500).optional(),
  people: z.array(PersonSchema).min(2).max(6),
});

type Variation = {
  title: string;
  sharedVibe: string;
  rationale: string;
  people: Array<{
    personId: string;
    summary: string;
    itemIds: string[];
    notes: string;
  }>;
};

type CollabResult = {
  eventRead: string;
  variations: Variation[];
};

function fallbackResult(body: z.infer<typeof BodySchema>): CollabResult {
  return {
    eventRead: [body.eventType, body.location, body.dressCode].filter(Boolean).join(" • "),
    variations: [
      {
        title: "Coordinated Edit",
        sharedVibe: body.sharedVibe || "cohesive, event-ready, personal",
        rationale: "Built from the available closets with similar formality and a shared palette.",
        people: body.people.map((person) => ({
          personId: person.id,
          summary: `${person.name} wears a balanced look from their closet.`,
          itemIds: person.closet.slice(0, 4).map((item) => item.id),
          notes: person.interests
            ? `Keep the styling close to ${person.interests}.`
            : "Keep the styling clean and coordinated.",
        })),
      },
    ],
  };
}

function privacyFilter(result: CollabResult, viewerPersonId: string): CollabResult {
  return {
    ...result,
    variations: result.variations.map((variation) => ({
      ...variation,
      people: variation.people.map((look) =>
        look.personId === viewerPersonId
          ? look
          : {
              personId: look.personId,
              summary: "Private outfit selected for this coordinated variation.",
              itemIds: [],
              notes:
                "Aligned on vibe, formality, and event practicality without revealing the outfit.",
            },
      ),
    })),
  };
}

function normalizeResult(value: unknown, body: z.infer<typeof BodySchema>): CollabResult {
  const fallback = fallbackResult(body);
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<CollabResult>;
  const idsByPerson = new Map(
    body.people.map((person) => [person.id, new Set(person.closet.map((item) => item.id))]),
  );

  return {
    eventRead: String(parsed.eventRead ?? fallback.eventRead),
    variations: Array.isArray(parsed.variations)
      ? parsed.variations.slice(0, 4).map((variation) => {
          const candidate = variation as Partial<Variation>;
          return {
            title: String(candidate.title ?? "Coordinated Edit"),
            sharedVibe: String(candidate.sharedVibe ?? fallback.variations[0].sharedVibe),
            rationale: String(candidate.rationale ?? fallback.variations[0].rationale),
            people: Array.isArray(candidate.people)
              ? candidate.people
                  .map((personLook) => {
                    const look = personLook as Variation["people"][number];
                    const validIds = idsByPerson.get(String(look.personId));
                    return {
                      personId: String(look.personId ?? ""),
                      summary: String(look.summary ?? ""),
                      itemIds: Array.isArray(look.itemIds)
                        ? look.itemIds
                            .map(String)
                            .filter((id) => validIds?.has(id))
                            .slice(0, 6)
                        : [],
                      notes: String(look.notes ?? ""),
                    };
                  })
                  .filter((look) => idsByPerson.has(look.personId))
              : [],
          };
        })
      : fallback.variations,
  };
}

function formatClosets(body: z.infer<typeof BodySchema>) {
  return body.people
    .map((person) => {
      const closet = person.closet
        .map((item) => {
          const tags = item.tags?.length ? ` | tags:${item.tags.join(", ")}` : "";
          return `  - id:${item.id} | ${item.name} | category:${item.category ?? ""} | detail:${item.detail ?? ""}${tags}`;
        })
        .join("\n");
      return `${person.name} (${person.id})
Interests: ${person.interests || "not provided"}
Closet:
${closet || "  - empty"}`;
    })
    .join("\n\n");
}

export const Route = createFileRoute("/api/collab-outfits")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = BodySchema.parse(await request.json());
        const key = process.env.OPENAI_API_KEY;
        if (!key) return Response.json(privacyFilter(fallbackResult(body), body.viewerPersonId));

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are an expert stylist for coordinated group dressing. Respond with strict JSON only. The caller may not be allowed to see every person's final outfit, so keep group-level rationale focused on shared vibe, color family, dress code, and formality instead of exposing another person's exact garments.",
              },
              {
                role: "user",
                content: `Create 3 coordinated outfit variations for this group. Each person must wear only items from their own closet. Match the people by vibe, palette, formality, and event suitability without making them identical.

Event:
- name: ${body.eventName ?? ""}
- type: ${body.eventType ?? ""}
- location: ${body.location ?? ""}
- dress code: ${body.dressCode ?? ""}
- shared vibe/interests: ${body.sharedVibe ?? ""}

People and closets:
${formatClosets(body)}

Use the location as styling context: infer indoor/outdoor practicality, likely formality, and mobility needs from the location text. If a closet is sparse, make the best possible partial look and say what is missing.

Return ONLY JSON:
{
  "eventRead": "brief interpretation of the event, location, and dress code",
  "variations": [
    {
      "title": "variation name",
      "sharedVibe": "shared style direction",
      "rationale": "why this works for the event and the group",
      "people": [
        {
          "personId": "exact person id",
          "summary": "one sentence outfit description",
          "itemIds": ["valid ids from this person's closet only"],
          "notes": "personal styling note"
        }
      ]
    }
  ]
}`,
              },
            ],
          }),
        });

        if (!res.ok) {
          return new Response(`OpenAI collaboration error: ${await res.text()}`, {
            status: res.status,
          });
        }

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = data.choices?.[0]?.message?.content ?? "{}";
        try {
          return Response.json(
            privacyFilter(normalizeResult(JSON.parse(text), body), body.viewerPersonId),
          );
        } catch {
          return Response.json(privacyFilter(fallbackResult(body), body.viewerPersonId));
        }
      },
    },
  },
});
