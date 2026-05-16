import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Save, Sparkles, Wand2, X } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useClosetCatalog } from "@/lib/use-closet";
import { imageToDataUrl } from "@/lib/image-to-data-url";
import { cn } from "@/lib/utils";
import type { ClosetItem, ClosetCategory } from "@/lib/closet";
import { saveGeneratedOutfit } from "@/lib/saved-outfits";

export const Route = createFileRoute("/styler")({
  head: () => ({
    meta: [
      { title: "Styler — Aura" },
      { name: "description", content: "Build an outfit from your closet and save the look." },
    ],
  }),
  component: StylerPage,
});

const CATEGORIES: ClosetCategory[] = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes"];

function StylerPage() {
  const { data, isLoading } = useClosetCatalog();
  const [selected, setSelected] = useState<Partial<Record<ClosetCategory, string>>>({});
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const byCategory = useMemo(() => {
    const out: Record<ClosetCategory, ClosetItem[]> = {
      Tops: [],
      Bottoms: [],
      Dresses: [],
      Outerwear: [],
      Shoes: [],
    };
    (data?.items ?? []).forEach((item) => {
      out[item.category]?.push(item);
    });
    return out;
  }, [data]);

  const selectedItems = useMemo(() => {
    if (!data) return [];
    return CATEGORIES.map((category) => {
      const id = selected[category];
      return id ? data.items.find((item) => item.id === id) : undefined;
    }).filter((item): item is ClosetItem => Boolean(item));
  }, [data, selected]);

  const toggleItem = (category: ClosetCategory, id: string) => {
    setSelected((current) => ({
      ...current,
      [category]: current[category] === id ? undefined : id,
    }));
    setResultUrl(null);
    setSaved(false);
  };

  const generate = async () => {
    if (!data) return;
    if (selectedItems.length === 0) {
      toast.error("Pick at least one piece to try on.");
      return;
    }

    setGenerating(true);
    setResultUrl(null);
    setSaved(false);
    try {
      const [avatarUrl, ...itemUrls] = await Promise.all([
        imageToDataUrl(new URL(data.avatarUrl, window.location.origin).toString(), 768),
        ...selectedItems.map((item) =>
          imageToDataUrl(new URL(item.image, window.location.origin).toString(), 512),
        ),
      ]);
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarUrl,
          items: selectedItems.map((item, idx) => ({
            name: item.name,
            detail: item.detail,
            imageUrl: itemUrls[idx],
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as { imageUrl: string };
      setResultUrl(d.imageUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate the look");
    } finally {
      setGenerating(false);
    }
  };

  const saveLook = async () => {
    if (!resultUrl) return;
    setSaving(true);
    try {
      await saveGeneratedOutfit({
        imageUrl: resultUrl,
        items: selectedItems.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          detail: item.detail,
          image: item.image,
        })),
      });

      setSaved(true);
      toast.success("Saved to Outfits");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the look");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <header className="px-4 pt-6 pb-4 md:px-10 md:pt-10 md:pb-6 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Wand2 className="size-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Styler
              </h2>
              <p className="text-sm text-muted-foreground">
                Pick pieces from your closet, generate a try-on, then save the finished look.
              </p>
            </div>
          </div>
        </header>

        <div className="px-4 py-6 md:px-10 md:py-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
          <section className="space-y-5">
            {isLoading ? (
              <div className="py-20 flex justify-center">
                <Shimmer>Loading your closet...</Shimmer>
              </div>
            ) : (data?.items.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-border bg-background p-10 text-center">
                <h3 className="text-lg font-semibold text-foreground">Your closet is empty</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload clothing in Closet first, then come back to build a look.
                </p>
                <Button asChild className="mt-5">
                  <Link to="/">Open Closet</Link>
                </Button>
              </div>
            ) : (
              CATEGORIES.map((category) => (
                <CategoryShelf
                  key={category}
                  category={category}
                  items={byCategory[category]}
                  selectedId={selected[category]}
                  onSelect={(id) => toggleItem(category, id)}
                />
              ))
            )}
          </section>

          <aside className="xl:sticky xl:top-8 self-start rounded-lg border border-border bg-background overflow-hidden">
            <div className="p-4 border-b border-border">
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Live Look
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-1">Selected pieces</h3>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {CATEGORIES.map((category) => {
                  const item = selected[category]
                    ? data?.items.find((candidate) => candidate.id === selected[category])
                    : null;
                  return (
                    <div
                      key={category}
                      className="aspect-square rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center"
                      title={category}
                    >
                      {item ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground text-center px-1">
                          {category}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="aspect-[3/4] rounded-lg bg-muted overflow-hidden relative">
                {generating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="size-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                    <Shimmer>Dressing you...</Shimmer>
                  </div>
                )}
                {!generating && resultUrl && (
                  <img
                    src={resultUrl}
                    alt="Generated outfit"
                    className="w-full h-full object-cover"
                  />
                )}
                {!generating && !resultUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <Sparkles className="size-6 mb-3" strokeWidth={1.5} />
                    <p className="text-sm">Generate a try-on preview from your selected pieces.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={generate}
                  disabled={generating || selectedItems.length === 0}
                  className="flex-1 gap-2"
                >
                  <Sparkles className="size-4" />
                  {generating ? "Generating..." : "Generate"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveLook}
                  disabled={!resultUrl || saving || saved}
                  className="gap-2"
                >
                  {saved ? <Check className="size-4" /> : <Save className="size-4" />}
                  {saved ? "Saved" : saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function CategoryShelf({
  category,
  items,
  selectedId,
  onSelect,
}: {
  category: ClosetCategory;
  items: ClosetItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{category}</h3>
          <p className="text-xs text-muted-foreground">
            {items.length === 0
              ? "No uploaded pieces yet"
              : `${items.length} piece${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(selectedId)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear
          </button>
        )}
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <div className="h-28 rounded-md border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
            Upload {category.toLowerCase()} in Closet
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
            {items.map((item) => {
              const active = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "group text-left rounded-md border bg-card overflow-hidden transition-all",
                    active
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    {active && (
                      <span className="absolute top-2 right-2 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="size-4" />
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.detail}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
