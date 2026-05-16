import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useClosetCatalog } from "@/lib/use-closet";
import { imageToDataUrl } from "@/lib/image-to-data-url";
import type { ClosetItem, ClosetCategory } from "@/lib/closet";
import { ChevronLeft, ChevronRight, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/styler")({
  head: () => ({
    meta: [
      { title: "Styler — Atelier AI" },
      { name: "description", content: "Swipe through your closet and dress your avatar." },
    ],
  }),
  component: StylerPage,
});

const CATEGORIES: ClosetCategory[] = ["Tops", "Bottoms", "Outerwear", "Shoes"];

function StylerPage() {
  const { data, isLoading } = useClosetCatalog();
  const [activeCat, setActiveCat] = useState<ClosetCategory>("Tops");
  const [selected, setSelected] = useState<Partial<Record<ClosetCategory, string>>>({});
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const byCategory = useMemo(() => {
    const out: Record<ClosetCategory, ClosetItem[]> = {
      Tops: [], Bottoms: [], Outerwear: [], Shoes: [], Dresses: [],
    };
    (data?.items ?? []).forEach((i) => {
      if (out[i.category]) out[i.category].push(i);
    });
    return out;
  }, [data]);

  const items = byCategory[activeCat] ?? [];

  const generate = async () => {
    if (!data) return;
    const ids = CATEGORIES.map((c) => selected[c]).filter((x): x is string => Boolean(x));
    if (ids.length === 0) {
      toast.error("Pick at least one piece to try on.");
      return;
    }
    const chosen = ids
      .map((id) => data.items.find((i) => i.id === id))
      .filter((i): i is ClosetItem => Boolean(i));

    setGenerating(true);
    setResultUrl(null);
    try {
      const [avatarUrl, ...itemUrls] = await Promise.all([
        imageToDataUrl(new URL(data.avatarUrl, window.location.origin).toString(), 768),
        ...chosen.map((i) =>
          imageToDataUrl(new URL(i.image, window.location.origin).toString(), 512),
        ),
      ]);
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarUrl,
          items: chosen.map((i, idx) => ({
            name: i.name,
            detail: i.detail,
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

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
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
                Swipe through your closet, build a look, generate the photo.
              </p>
            </div>
          </div>
        </header>

        {/* Category tabs */}
        <div className="px-4 md:px-10 pt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const count = byCategory[cat]?.length ?? 0;
            const has = selected[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                disabled={count === 0}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  activeCat === cat
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-accent",
                  count === 0 && "opacity-40 cursor-not-allowed",
                )}
              >
                {cat}
                {has && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary" />}
                <span className="ml-1.5 text-xs opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Stage */}
        <div className="flex-1 flex items-center justify-center px-2 py-6 md:py-10 overflow-hidden">
          {isLoading ? (
            <Shimmer>Loading your closet...</Shimmer>
          ) : (
            <OrbitStage
              avatarUrl={data?.avatarUrl ?? ""}
              items={items}
              selectedId={selected[activeCat]}
              onSelect={(id) => setSelected((s) => ({ ...s, [activeCat]: id }))}
            />
          )}
        </div>

        {/* Selected strip + generate */}
        <div className="border-t border-border bg-background px-4 md:px-10 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex-1 flex gap-2 overflow-x-auto">
              {CATEGORIES.map((cat) => {
                const id = selected[cat];
                const item = id ? data?.items.find((i) => i.id === id) : null;
                return (
                  <div
                    key={cat}
                    className="shrink-0 w-14 h-14 rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center"
                    title={cat}
                  >
                    {item ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground text-center px-1">
                        {cat}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <Button onClick={generate} disabled={generating} size="lg" className="gap-2">
              <Sparkles className="size-4" />
              {generating ? "Generating..." : "Generate Look"}
            </Button>
          </div>
        </div>
      </main>

      {/* Result modal */}
      {(generating || resultUrl) && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-center justify-center p-4">
          <div className="relative max-w-md w-full rounded-2xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => {
                setResultUrl(null);
                setGenerating(false);
              }}
              className="absolute top-3 right-3 z-10 size-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <div className="aspect-[3/4] bg-muted relative">
              {generating && !resultUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <div className="size-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                  <Shimmer>Dressing you...</Shimmer>
                </div>
              )}
              {resultUrl && (
                <img src={resultUrl} alt="Your generated look" className="w-full h-full object-cover" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrbitStage({
  avatarUrl,
  items,
  selectedId,
  onSelect,
}: {
  avatarUrl: string;
  items: ClosetItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [index, setIndex] = useState(0);
  const dragRef = useRef<{ startX: number; startRot: number } | null>(null);

  // When items change (category swap), reset rotation but try to honor existing selection
  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      setRotation(0);
      return;
    }
    const i = selectedId ? items.findIndex((x) => x.id === selectedId) : 0;
    const newIdx = i >= 0 ? i : 0;
    setIndex(newIdx);
    setRotation(-newIdx * (360 / items.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const step = items.length > 0 ? 360 / items.length : 0;

  const snapTo = (rawRot: number) => {
    if (items.length === 0) return;
    const k = Math.round(-rawRot / step);
    const newIdx = ((k % items.length) + items.length) % items.length;
    setIndex(newIdx);
    setRotation(-newIdx * step);
    onSelect(items[newIdx].id);
  };

  const cycle = (dir: 1 | -1) => {
    if (items.length === 0) return;
    const newIdx = (index + dir + items.length) % items.length;
    setIndex(newIdx);
    setRotation(-newIdx * step);
    onSelect(items[newIdx].id);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startRot: rotation };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    setRotation(dragRef.current.startRot + dx * 0.4);
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    snapTo(rotation);
  };

  // Radius scales with viewport
  const radius = 220;

  return (
    <div className="relative w-full max-w-[640px] aspect-square mx-auto select-none">
      {/* Avatar center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-muted shadow-xl z-10">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Your avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Upload an avatar
          </div>
        )}
      </div>

      {/* Orbit ring */}
      <div
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No items in this category yet.
          </div>
        )}
        {items.map((item, i) => {
          const angle = (i * step + rotation) * (Math.PI / 180);
          const x = Math.sin(angle) * radius;
          const y = -Math.cos(angle) * radius;
          const isActive = i === index;
          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
                setRotation(-i * step);
                onSelect(item.id);
              }}
              className={cn(
                "absolute left-1/2 top-1/2 transition-all duration-300 ease-out rounded-xl overflow-hidden border-2 bg-background shadow-lg",
                isActive
                  ? "border-primary scale-110 ring-2 ring-primary/30"
                  : "border-border opacity-70 hover:opacity-100",
              )}
              style={{
                width: 88,
                height: 88,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
            >
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </button>
          );
        })}
      </div>

      {/* Prev / Next */}
      {items.length > 1 && (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cycle(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 rounded-full"
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cycle(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 rounded-full"
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </Button>
        </>
      )}

      {/* Active item label */}
      {items[index] && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center z-20 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full border border-border">
          <p className="text-xs font-medium text-foreground">{items[index].name}</p>
        </div>
      )}
    </div>
  );
}
