import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { OutfitCard } from "@/components/outfit-card";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";

interface PlannedEvent {
  id: string;
  summary: string;
  location?: string;
  start: string | null;
  end: string | null;
  rationale: string;
  outfitIds: string[];
}

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Atelier AI" },
      {
        name: "description",
        content: "Today's calendar, styled. Outfits planned for every event.",
      },
    ],
  }),
  component: TodayPage,
});

async function fetchToday(): Promise<{ events: PlannedEvent[] }> {
  const res = await fetch("/api/today");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  // Date-only events have no time
  if (!iso.includes("T")) return "All day";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TodayPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["today"],
    queryFn: fetchToday,
    refetchOnWindowFocus: false,
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <header className="px-10 pt-10 pb-6 border-b border-border bg-background">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Calendar className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Today
                </h2>
                <p className="text-sm text-muted-foreground">
                  {today} — your schedule, styled.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? "Re-planning…" : "Re-plan day"}
            </Button>
          </div>
        </header>

        <div className="flex-1 px-10 py-8">
          <div className="max-w-4xl mx-auto">
            {isLoading && (
              <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <Sparkles className="size-6" strokeWidth={1.5} />
                <Shimmer>Reading your calendar and styling looks…</Shimmer>
              </div>
            )}

            {isError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                <p className="font-semibold mb-1">Couldn't plan your day</p>
                <p className="opacity-80">
                  {error instanceof Error ? error.message : "Unknown error"}
                </p>
              </div>
            )}

            {data && data.events.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <Calendar
                  className="size-8 mx-auto text-muted-foreground mb-3"
                  strokeWidth={1.5}
                />
                <h3 className="text-lg font-semibold text-foreground">
                  Nothing on your calendar today
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enjoy the day off — or head to the Stylist to plan something
                  ahead.
                </p>
              </div>
            )}

            {data && data.events.length > 0 && (
              <div className="space-y-10">
                {data.events.map((ev) => (
                  <EventBlock key={ev.id} event={ev} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function EventBlock({ event }: { event: PlannedEvent }) {
  const eventContext = [
    event.summary,
    event.location,
    event.start ? `at ${formatTime(event.start)}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <section className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-2">
          {formatTime(event.start)}
          {event.end && event.end !== event.start
            ? ` – ${formatTime(event.end)}`
            : ""}
        </p>
        <h3 className="text-2xl font-bold tracking-tight text-foreground">
          {event.summary}
        </h3>
        {event.location && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" strokeWidth={1.75} />
            {event.location}
          </p>
        )}
        {event.rationale && (
          <p className="mt-4 text-sm leading-relaxed text-foreground/80">
            {event.rationale}
          </p>
        )}
        {event.outfitIds.length === 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" strokeWidth={1.75} />
            No outfit could be planned for this event.
          </p>
        )}
      </div>
      {event.outfitIds.length > 0 && (
        <OutfitCard ids={event.outfitIds} eventContext={eventContext} />
      )}
    </section>
  );
}
