import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Lock, Sparkles, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sidebar } from "@/components/sidebar";
import type { ClosetItem, ClosetTags } from "@/lib/closet";
import { useClosetCatalog } from "@/lib/use-closet";
import {
  getMockAvatarUrl,
  getMockClosetItems,
  mockOwnerKey,
  mockUsers,
  useMockUser,
  type MockUser,
} from "@/lib/mock-user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/couples")({
  component: Collaborate,
  head: () => ({
    meta: [
      {
        name: "description",
        content: "Create private coordinated outfit ideas with invited collaborators.",
      },
    ],
  }),
});

type ApiVariation = {
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

type ApiResult = {
  eventRead: string;
  variations: ApiVariation[];
};

type ClosetPayloadItem = {
  id: string;
  name: string;
  category?: string;
  detail?: string;
  tags?: string[];
};

function tagsToStrings(tags?: ClosetTags): string[] {
  if (!tags) return [];
  return [
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
  ].filter(Boolean);
}

function toPayload(items: ClosetItem[]): ClosetPayloadItem[] {
  return items.slice(0, 30).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    detail: item.detail,
    tags: tagsToStrings(item.tags),
  }));
}

function mockCloset(user: MockUser): ClosetItem[] {
  return getMockClosetItems(mockOwnerKey(user)).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category as ClosetItem["category"],
    detail: item.detail,
    image: item.image_url,
    tags: item.tags as ClosetTags | undefined,
  }));
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function collaboratorAvatar(user: MockUser) {
  return getMockAvatarUrl(mockOwnerKey(user));
}

function Collaborate() {
  const mockUser = useMockUser();
  const { data } = useClosetCatalog();
  const invitedPeople = useMemo(
    () => mockUsers.filter((user) => user.id !== mockUser?.id),
    [mockUser?.id],
  );
  const [selectedId, setSelectedId] = useState(invitedPeople[0]?.id ?? "");
  const [prompt, setPrompt] = useState("date night, relaxed but polished");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (invitedPeople.some((person) => person.id === selectedId)) return;
    setSelectedId(invitedPeople[0]?.id ?? "");
    setResult(null);
  }, [invitedPeople, selectedId]);

  const selectedPerson =
    invitedPeople.find((person) => person.id === selectedId) ?? invitedPeople[0] ?? null;
  const currentPersonId = mockUser?.id ?? "current-user";
  const currentName = mockUser?.name ?? "You";
  const currentCloset = useMemo(() => data?.items ?? [], [data?.items]);
  const selectedCloset = useMemo(
    () => (selectedPerson ? mockCloset(selectedPerson) : []),
    [selectedPerson],
  );
  const currentLookByVariation = useMemo(() => {
    const itemsById = new Map(currentCloset.map((item) => [item.id, item]));
    return new Map(
      (result?.variations ?? []).map((variation) => {
        const look = variation.people.find((person) => person.personId === currentPersonId);
        return [
          variation.title,
          {
            look,
            items: (look?.itemIds ?? []).map((id) => itemsById.get(id)).filter(Boolean),
          },
        ];
      }),
    );
  }, [currentCloset, currentPersonId, result]);

  async function generateStyles() {
    if (!selectedPerson) {
      toast.error("Select a collaborator");
      return;
    }
    if (currentCloset.length === 0) {
      toast.error("Upload a few pieces to your closet first");
      return;
    }
    if (selectedCloset.length === 0) {
      toast.error(`${selectedPerson.name} needs demo closet pieces first`);
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/collab-outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewerPersonId: currentPersonId,
          eventName: "Collaborative style session",
          eventType: prompt,
          sharedVibe: `Match ${selectedPerson.name}'s existing closet vibe while keeping the user's outfit private. User request: ${prompt}`,
          people: [
            {
              id: currentPersonId,
              name: currentName,
              interests: prompt,
              closet: toPayload(currentCloset),
            },
            {
              id: selectedPerson.id,
              name: selectedPerson.name,
              interests:
                "Existing invited collaborator style, inferred from their private closet tags.",
              closet: toPayload(selectedCloset),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult((await res.json()) as ApiResult);
      toast.success("Generated private coordinated styles");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate styles");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <header className="border-b border-border bg-background px-4 py-6 md:px-10 md:py-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
                Collaborate
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Pick an invited person and generate a look that matches their vibe privately.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <Lock className="size-3.5" />
              Wardrobes stay hidden
            </div>
          </div>
        </header>

        <div className="px-4 py-6 md:px-10 md:py-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              <div className="rounded-lg border border-border bg-background p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Invited people</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select who you want to coordinate with.
                    </p>
                  </div>
                  <Users className="size-5 text-muted-foreground" />
                </div>

                <div className="mt-5 flex flex-wrap gap-4">
                  {invitedPeople.map((person) => {
                    const selected = selectedPerson?.id === person.id;
                    const avatar = collaboratorAvatar(person);
                    const count = mockCloset(person).length;
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(person.id);
                          setResult(null);
                        }}
                        className="group flex w-24 flex-col items-center gap-2 text-center"
                      >
                        <span
                          className={cn(
                            "relative flex size-16 items-center justify-center overflow-hidden rounded-full border-2 bg-accent text-sm font-semibold text-foreground transition-colors",
                            selected
                              ? "border-primary"
                              : "border-border group-hover:border-primary/50",
                          )}
                        >
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={person.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            initials(person.name)
                          )}
                          <span
                            className={cn(
                              "absolute bottom-0 right-0 size-4 rounded-full border-2 border-background",
                              count > 0 ? "bg-emerald-500" : "bg-muted-foreground",
                            )}
                          />
                        </span>
                        <span className="max-w-full truncate text-xs font-semibold text-foreground">
                          {person.name}
                        </span>
                        {person.id === mockUsers[0].id && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Main user
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      What should you match?
                    </span>
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={4}
                      placeholder="Dinner date, casual concert, matching earth tones, not too formal..."
                      className="w-full resize-none rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none focus:bg-background"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={generateStyles}
                    disabled={generating}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {generating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {generating ? "Generating..." : "Generate styles"}
                  </button>
                </div>
              </div>

              {result && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-background p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Style read
                    </p>
                    <p className="mt-2 text-sm text-foreground">{result.eventRead}</p>
                  </div>

                  {result.variations.map((variation) => {
                    const current = currentLookByVariation.get(variation.title);
                    return (
                      <article
                        key={variation.title}
                        className="rounded-lg border border-border bg-background p-5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">
                              {variation.title}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {variation.sharedVibe}
                            </p>
                          </div>
                          <span className="inline-flex w-fit items-center gap-1.5 rounded bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                            <Lock className="size-3" />
                            Private match
                          </span>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">{variation.rationale}</p>

                        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_260px]">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Your suggested pieces
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {current?.look?.summary ?? "No specific pieces selected."}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                              {(current?.items ?? []).map((item) => (
                                <div key={item.id} className="min-w-0">
                                  <div className="aspect-square overflow-hidden rounded-md bg-muted">
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="size-full object-cover"
                                    />
                                  </div>
                                  <p className="mt-1 truncate text-xs font-medium text-foreground">
                                    {item.name}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg border border-border bg-muted/30 p-4">
                            <div className="flex items-center gap-2">
                              <UserRound className="size-4 text-muted-foreground" />
                              <p className="text-sm font-semibold text-foreground">
                                {selectedPerson?.name}
                              </p>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Their outfit stays private. The match uses only shared signals like
                              palette, formality, and vibe.
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Current setup
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">You</span>
                    <span className="font-medium text-foreground">
                      {currentCloset.length} pieces
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {selectedPerson?.name ?? "Partner"}
                    </span>
                    <span className="font-medium text-foreground">
                      {selectedCloset.length} pieces
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-5">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Privacy
                  </h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  You choose a collaborator, but you only see your own outfit recommendations. Their
                  closet is used as private style context for a matching vibe.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
