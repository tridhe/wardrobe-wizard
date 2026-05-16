import { useEffect, useRef, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { closetItems } from "@/lib/closet";

export function OutfitCard({
  ids,
  eventContext,
}: {
  ids: string[];
  eventContext?: string;
}) {
  const items = ids
    .map((id) => closetItems.find((c) => c.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const [tryonUrl, setTryonUrl] = useState<string | null>(null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [tryonError, setTryonError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setTryonLoading(true);
    fetch("/api/tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ids, eventContext }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ imageUrl: string }>;
      })
      .then((data) => setTryonUrl(data.imageUrl))
      .catch((err) => setTryonError(err.message || "Couldn't generate try-on"))
      .finally(() => setTryonLoading(false));
  }, [ids, eventContext]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="aspect-[3/4] bg-muted relative">
        {tryonLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="size-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            <Shimmer>Dressing you for the occasion...</Shimmer>
          </div>
        )}
        {tryonError && !tryonLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive p-4 text-center">
            {tryonError}
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
          The Look
        </p>
        <div className="grid grid-cols-4 gap-2">
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
