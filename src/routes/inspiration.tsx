import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Sparkles, Upload, X } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useClosetCatalog } from "@/lib/use-closet";
import { imageToDataUrl } from "@/lib/image-to-data-url";
import type { InspirationResult } from "./api/inspiration";

export const Route = createFileRoute("/inspiration")({
  head: () => ({
    meta: [
      { title: "Inspiration — Aura" },
      {
        name: "description",
        content: "Match inspiration outfits against your existing closet.",
      },
    ],
  }),
  component: InspirationPage,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function InspirationPage() {
  const { data } = useClosetCatalog();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [result, setResult] = useState<InspirationResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tryonUrl, setTryonUrl] = useState<string | null>(null);

  const matchedItems = useMemo(() => {
    if (!data || !result) return [];
    return result.matches
      .map((match) => ({
        match,
        item: data.items.find((candidate) => candidate.id === match.itemId),
      }))
      .filter(
        (
          entry,
        ): entry is {
          match: (typeof result.matches)[number];
          item: NonNullable<typeof entry.item>;
        } => Boolean(entry.item),
      );
  }, [data, result]);

  const pickFiles = (nextFiles: FileList | null) => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    const selected = Array.from(nextFiles ?? []).slice(0, 4);
    setFiles(selected);
    setPreviews(selected.map((file) => URL.createObjectURL(file)));
    setResult(null);
    setTryonUrl(null);
  };

  const analyze = async () => {
    if (files.length === 0) {
      toast.error("Upload at least one inspiration image");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    setTryonUrl(null);
    try {
      const images = await Promise.all(files.map(fileToDataUrl));
      const res = await fetch("/api/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult((await res.json()) as InspirationResult);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyze inspiration");
    } finally {
      setAnalyzing(false);
    }
  };

  const generateTryOn = async () => {
    if (!data || matchedItems.length === 0) return;
    setGenerating(true);
    setTryonUrl(null);
    try {
      const chosen = matchedItems.map(({ item }) => item).slice(0, 6);
      const [avatarUrl, ...itemUrls] = await Promise.all([
        imageToDataUrl(new URL(data.avatarUrl, window.location.origin).toString(), 768),
        ...chosen.map((item) =>
          imageToDataUrl(new URL(item.image, window.location.origin).toString(), 512),
        ),
      ]);
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarUrl,
          eventContext: result?.summary,
          items: chosen.map((item, idx) => ({
            name: item.name,
            detail: item.detail,
            imageUrl: itemUrls[idx],
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as { imageUrl: string };
      setTryonUrl(d.imageUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate try-on");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <header className="px-4 pt-6 pb-4 md:px-10 md:pt-10 md:pb-6 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Camera className="size-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Inspiration
              </h2>
              <p className="text-sm text-muted-foreground">
                Upload a look you almost bought, then find what your closet can already do.
              </p>
            </div>
          </div>
        </header>

        <div className="px-4 py-6 md:px-10 md:py-8 grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
          <section className="rounded-lg border border-border bg-background p-4 self-start">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Reference
            </p>
            <label className="mt-3 block">
              <div className="relative min-h-64 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:border-foreground/40 cursor-pointer p-3 flex items-center justify-center">
                {previews.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {previews.map((preview, index) => (
                      <div
                        key={preview}
                        className="aspect-square rounded-md bg-muted overflow-hidden"
                      >
                        <img
                          src={preview}
                          alt={`Inspiration ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Upload className="size-6 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-foreground">Upload inspiration images</p>
                    <p className="text-xs mt-1">
                      Screenshots from Instagram, TikTok, or shopping pages
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(event) => pickFiles(event.target.files)}
                />
              </div>
            </label>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={analyze}
                disabled={analyzing || files.length === 0}
                className="flex-1 gap-2"
              >
                <Sparkles className="size-4" />
                {analyzing ? "Analyzing..." : "Find Matches"}
              </Button>
              {files.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => pickFiles(null)}
                  aria-label="Clear inspiration images"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-6">
            {!result && !analyzing && (
              <div className="rounded-lg border border-border bg-background p-10 text-center">
                <Sparkles className="size-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold text-foreground">
                  Shop your own closet first
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add an inspiration image and Aura will extract the pieces, mood, colors, and
                  closest matches.
                </p>
              </div>
            )}

            {analyzing && (
              <div className="rounded-lg border border-border bg-background p-10 flex justify-center">
                <Shimmer>Reading the outfit and checking your closet...</Shimmer>
              </div>
            )}

            {result && (
              <>
                <div className="rounded-lg border border-border bg-background p-5">
                  <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                    Extracted Style
                  </p>
                  <h3 className="text-xl font-semibold text-foreground mt-2">{result.summary}</h3>
                  {result.vibe && (
                    <p className="text-sm text-muted-foreground mt-1">{result.vibe}</p>
                  )}
                  {result.detectedPieces.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.detectedPieces.map((piece, index) => (
                        <span
                          key={`${piece.category}-${index}`}
                          className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground"
                        >
                          {[piece.color, piece.garmentType || piece.category]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-background p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                        Closet Matches
                      </p>
                      <h3 className="text-lg font-semibold text-foreground mt-1">
                        {matchedItems.length} matching piece{matchedItems.length === 1 ? "" : "s"}
                      </h3>
                    </div>
                    <Button
                      onClick={generateTryOn}
                      disabled={matchedItems.length === 0 || generating}
                      className="gap-2"
                    >
                      <Sparkles className="size-4" />
                      {generating ? "Generating..." : "Try it on"}
                    </Button>
                  </div>

                  {matchedItems.length === 0 ? (
                    <div className="mt-5 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No close closet matches found yet.
                    </div>
                  ) : (
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {matchedItems.map(({ item, match }) => (
                        <article
                          key={item.id}
                          className="rounded-md border border-border overflow-hidden bg-card"
                        >
                          <div className="aspect-square bg-muted">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <Check className="size-4 mt-0.5 text-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.category} • {item.detail}
                                </p>
                              </div>
                            </div>
                            {match.reason && (
                              <p className="mt-2 text-xs leading-relaxed text-foreground/75">
                                {match.reason}
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                {(tryonUrl || generating) && (
                  <div className="rounded-lg border border-border bg-background overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                        On You
                      </p>
                    </div>
                    <div className="max-w-md mx-auto aspect-[3/4] bg-muted relative">
                      {generating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                          <div className="size-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                          <Shimmer>Styling your matched pieces...</Shimmer>
                        </div>
                      )}
                      {tryonUrl && (
                        <img
                          src={tryonUrl}
                          alt="Inspired outfit on you"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                )}

                {result.missingPieces.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-5">
                    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                      Gaps
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                      {result.missingPieces.map((piece) => (
                        <li key={piece}>{piece}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.stylingAdvice && (
                  <div className="rounded-lg border border-border bg-background p-5">
                    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                      Styling Note
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                      {result.stylingAdvice}
                    </p>
                  </div>
                )}

                {(data?.items.length ?? 0) === 0 && (
                  <div className="rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
                    Upload your clothes before matching inspiration images.{" "}
                    <Link to="/" className="font-medium text-foreground hover:underline">
                      Open Closet
                    </Link>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
