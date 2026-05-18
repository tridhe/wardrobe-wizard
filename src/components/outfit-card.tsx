import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { useClosetCatalog } from "@/lib/use-closet";
import { imageToDataUrl } from "@/lib/image-to-data-url";
import { saveGeneratedOutfit } from "@/lib/saved-outfits";

type OutfitCardProps = {
  ids: string[];
  eventContext?: string;
  generationKey?: string | number;
  initialImageUrl?: string | null;
  saveToOutfits?: boolean;
  onGenerated?: (imageUrl: string) => void | Promise<void>;
};

const TRYON_TIMEOUT_MS = 90000;

export function OutfitCard({
  ids,
  eventContext,
  generationKey,
  initialImageUrl,
  saveToOutfits = false,
  onGenerated,
}: OutfitCardProps) {
  const { data, isLoading: catalogLoading } = useClosetCatalog();
  const idsKey = ids.join("|");
  const items = useMemo(
    () =>
      data
        ? idsKey
            .split("|")
            .filter(Boolean)
            .map((id) => data.items.find((c) => c.id === id))
            .filter((i): i is NonNullable<typeof i> => Boolean(i))
        : [],
    [data, idsKey],
  );

  const [tryonUrl, setTryonUrl] = useState<string | null>(initialImageUrl ?? null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [tryonError, setTryonError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [retryRun, setRetryRun] = useState(0);
  const startedRef = useRef(false);
  const onGeneratedRef = useRef(onGenerated);

  useEffect(() => {
    onGeneratedRef.current = onGenerated;
  }, [onGenerated]);

  useEffect(() => {
    startedRef.current = Boolean(initialImageUrl);
    setTryonUrl(initialImageUrl ?? null);
    setTryonError(null);
    setTryonLoading(false);
    setSaved(false);
    setRetryRun(0);
  }, [eventContext, generationKey, idsKey, initialImageUrl]);

  useEffect(() => {
    if (startedRef.current || !data || items.length === 0) return;
    startedRef.current = true;
    setTryonLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), TRYON_TIMEOUT_MS);
    let active = true;

    (async () => {
      try {
        const trimmed = items.slice(0, 6);
        const [avatarUrl, ...itemUrls] = await Promise.all([
          imageToDataUrl(new URL(data.avatarUrl, window.location.origin).toString(), 768),
          ...trimmed.map((i) =>
            imageToDataUrl(new URL(i.image, window.location.origin).toString(), 512),
          ),
        ]);

        const payload = {
          items: trimmed.map((i, idx) => ({
            name: i.name,
            detail: i.detail,
            imageUrl: itemUrls[idx],
          })),
          avatarUrl,
          eventContext,
        };

        const res = await fetch("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const d = (await res.json()) as { imageUrl: string };
        if (!active) return;
        setTryonUrl(d.imageUrl);
        await onGeneratedRef.current?.(d.imageUrl);
        if (saveToOutfits) {
          await saveGeneratedOutfit({
            imageUrl: d.imageUrl,
            items: trimmed.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              detail: item.detail,
              image: item.image,
            })),
          });
          setSaved(true);
        }
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "Try-on generation timed out. You can retry this look."
            : err instanceof Error
              ? err.message
              : "Couldn't generate try-on";
        setTryonError(message);
        toast.error(message);
      } finally {
        window.clearTimeout(timeout);
        if (active) setTryonLoading(false);
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [data, items, eventContext, generationKey, idsKey, retryRun, saveToOutfits]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="aspect-[3/4] bg-muted relative">
        {(tryonLoading || catalogLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="size-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            <Shimmer>Dressing you for the occasion...</Shimmer>
          </div>
        )}
        {tryonError && !tryonLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-sm text-destructive">{tryonError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setTryonError(null);
                startedRef.current = false;
                setRetryRun((run) => run + 1);
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {tryonUrl && (
          <img
            src={tryonUrl}
            alt="You styled for the event"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-3">
          {saved ? "Saved to Outfits" : "The Look"}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {items.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="aspect-square rounded-md overflow-hidden bg-muted">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <p className="text-[11px] font-medium leading-tight text-foreground truncate">
                {item.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
