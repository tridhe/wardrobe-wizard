import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, MapPin, Clock, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { OutfitCard } from "@/components/outfit-card";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useClosetCatalog } from "@/lib/use-closet";
import { useMockUser } from "@/lib/mock-user";
import type { ClosetItem } from "@/lib/closet";

interface PlannedEvent {
  id: string;
  summary: string;
  location?: string;
  start: string | null;
  end: string | null;
  variants: OutfitVariant[];
}

interface OutfitVariant {
  id: string;
  label: string;
  rationale: string;
  outfitIds: string[];
  imageUrl?: string;
}

type TodayPlan = {
  date: string;
  events: PlannedEvent[];
};

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Aura" },
      {
        name: "description",
        content: "Today's calendar, styled. Outfits planned for every event.",
      },
    ],
  }),
  component: TodayPage,
});

import { supabase } from "@/integrations/supabase/client";

type CalendarStatus = {
  state: "connected" | "missing-token";
  message: string;
};

function todayDateKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayPlanKey(userId?: string) {
  return `today_plan:${userId ?? "anonymous"}:${todayDateKey()}`;
}

function dateAt(hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function pickItems(items: ClosetItem[], run: number, categories: string[], fallbackCount = 3) {
  const selected: ClosetItem[] = [];
  for (const category of categories) {
    const matches = items.filter((item) => item.category === category);
    if (matches.length > 0) selected.push(matches[run % matches.length]);
  }
  const remaining = items.filter((item) => !selected.some((picked) => picked.id === item.id));
  return [...selected, ...remaining.slice(run % Math.max(remaining.length, 1), run + fallbackCount)]
    .filter(Boolean)
    .slice(0, 6)
    .map((item) => item.id);
}

function buildMockTodayPlan(items: ClosetItem[], run = 0): TodayPlan {
  const templates = [
    {
      id: "mock-brunch",
      summary: "Coffee catch-up",
      location: "Neighborhood cafe",
      start: dateAt(10, 30),
      end: dateAt(11, 30),
      tone: "easy, polished, and daytime-friendly",
    },
    {
      id: "mock-workshop",
      summary: "Design workshop",
      location: "Studio space",
      start: dateAt(14),
      end: dateAt(16),
      tone: "comfortable, creative, and put together",
    },
    {
      id: "mock-dinner",
      summary: "Dinner plans",
      location: "Downtown",
      start: dateAt(19, 30),
      end: dateAt(21),
      tone: "date-night sharp without feeling too formal",
    },
  ];

  return {
    date: todayDateKey(),
    events: templates.map((event, eventIndex) => {
      const offset = run + eventIndex;
      return {
        id: event.id,
        summary: event.summary,
        location: event.location,
        start: event.start,
        end: event.end,
        variants: [
          {
            id: `variant-${offset}-1`,
            label: "Balanced",
            rationale: `A ${event.tone} outfit from the current demo closet.`,
            outfitIds: pickItems(items, offset, ["Tops", "Bottoms", "Shoes", "Outerwear"]),
          },
          {
            id: `variant-${offset}-2`,
            label: "Relaxed",
            rationale: "A softer variation using the next closest closet pieces.",
            outfitIds: pickItems(items, offset + 1, ["Dresses", "Shoes", "Outerwear", "Tops"]),
          },
          {
            id: `variant-${offset}-3`,
            label: "Sharp",
            rationale: "A more styled option with the strongest available pieces.",
            outfitIds: pickItems(items, offset + 2, ["Outerwear", "Tops", "Bottoms", "Shoes"]),
          },
        ].filter((variant) => variant.outfitIds.length > 0),
      };
    }),
  };
}

function parseTodayPlan(value?: string | null): TodayPlan | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as TodayPlan;
    if (parsed?.date === todayDateKey() && Array.isArray(parsed.events)) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

async function saveTodayPlan(plan: TodayPlan) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  const { error } = await supabase.from("app_settings").upsert({
    key: todayPlanKey(userId),
    value: JSON.stringify(plan),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function checkCalendarStatus(): Promise<CalendarStatus> {
  const { data } = await supabase.auth.getSession();
  const providerToken = data.session?.provider_token;
  if (!providerToken) {
    return {
      state: "missing-token",
      message: "Google Calendar is not connected. Sign out and sign in with Google again.",
    };
  }
  const res = await fetch("/api/today", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerToken, checkOnly: true }),
  });
  if (!res.ok) throw new Error(await res.text());
  return {
    state: "connected",
    message: "Google Calendar is connected and responding.",
  };
}

async function fetchToday(force = false): Promise<TodayPlan> {
  const { data } = await supabase.auth.getSession();
  const providerToken = data.session?.provider_token;
  const userId = data.session?.user.id;
  if (!providerToken) {
    throw new Error(
      "Google Calendar access expired. Please sign out and sign in again with Google.",
    );
  }

  if (!force) {
    const { data: cached, error: cacheError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", todayPlanKey(userId))
      .maybeSingle();
    if (cacheError) throw cacheError;
    const cachedPlan = parseTodayPlan(cached?.value);
    if (cachedPlan) return cachedPlan;
  }

  const res = await fetch("/api/today", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerToken }),
  });
  if (!res.ok) throw new Error(await res.text());
  const planned = (await res.json()) as { events: PlannedEvent[] };
  const plan = { date: todayDateKey(), events: planned.events };
  await saveTodayPlan(plan);
  return plan;
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
  const queryClient = useQueryClient();
  const mockUser = useMockUser();
  const { data: closetData, isLoading: closetLoading } = useClosetCatalog();
  const [isSwitching, setIsSwitching] = useState(false);
  const [generationRun, setGenerationRun] = useState(0);
  const generationRunRef = useRef(generationRun);
  const todayQueryKey = useMemo(() => ["today", mockUser?.id ?? "real"], [mockUser?.id]);
  const calendarStatus = useQuery({
    queryKey: ["calendar-status", mockUser?.id ?? "real"],
    queryFn: () =>
      mockUser
        ? ({
            state: "connected",
            message: `${mockUser.name}'s demo calendar is ready.`,
          } satisfies CalendarStatus)
        : checkCalendarStatus(),
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: todayQueryKey,
    queryFn: () => (mockUser ? buildMockTodayPlan(closetData?.items ?? [], 0) : fetchToday(false)),
    refetchOnWindowFocus: false,
    enabled:
      calendarStatus.data?.state === "connected" &&
      (!mockUser || (!closetLoading && Boolean(closetData))),
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    generationRunRef.current = generationRun;
  }, [generationRun]);

  const reconnectCalendar = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/today`,
        scopes: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) toast.error(error.message || "Could not reconnect Google Calendar");
  };

  const handleSwitchItUp = async () => {
    setIsSwitching(true);
    try {
      if (mockUser) {
        if ((closetData?.items.length ?? 0) === 0) {
          toast.error(`${mockUser.name} needs closet pieces before Aura can generate looks`);
          return;
        }
        setGenerationRun((run) => {
          const nextRun = run + 1;
          queryClient.setQueryData(
            todayQueryKey,
            buildMockTodayPlan(closetData?.items ?? [], nextRun),
          );
          return nextRun;
        });
      } else {
        const fresh = await fetchToday(true);
        queryClient.setQueryData(todayQueryKey, fresh);
        setGenerationRun((run) => run + 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't switch up today's outfits");
    } finally {
      setIsSwitching(false);
    }
  };

  const handleVariantImage = useCallback(
    async (eventId: string, variantId: string, imageUrl: string, run: number) => {
      if (run !== generationRunRef.current) return;
      const current = queryClient.getQueryData<TodayPlan>(todayQueryKey);
      if (!current) return;
      const next: TodayPlan = {
        ...current,
        events: current.events.map((event) =>
          event.id === eventId
            ? {
                ...event,
                variants: event.variants.map((variant) =>
                  variant.id === variantId ? { ...variant, imageUrl } : variant,
                ),
              }
            : event,
        ),
      };
      queryClient.setQueryData(todayQueryKey, next);
      if (mockUser) return;
      try {
        await saveTodayPlan(next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save generated look");
      }
    },
    [mockUser, queryClient, todayQueryKey],
  );

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="px-4 pt-6 pb-4 md:px-10 md:pt-10 md:pb-6 border-b border-border bg-background">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Calendar className="size-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                  Today
                </h2>
                <p className="text-sm text-muted-foreground truncate">
                  {today} — your schedule, styled.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchItUp}
              disabled={isFetching || isSwitching}
              className="self-start sm:self-auto"
            >
              {isFetching || isSwitching ? "Styling…" : "Switch it up"}
            </Button>
          </div>
        </header>

        <div className="flex-1 px-4 py-6 md:px-10 md:py-8">
          <div className="max-w-4xl mx-auto">
            <CalendarStatusCard
              isLoading={calendarStatus.isLoading}
              isError={calendarStatus.isError}
              error={calendarStatus.error}
              status={calendarStatus.data}
              onRetry={() => calendarStatus.refetch()}
              onReconnect={reconnectCalendar}
            />

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
                <Calendar className="size-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold text-foreground">
                  Nothing on your calendar today
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enjoy the day off — or head to the Stylist to plan something ahead.
                </p>
              </div>
            )}

            {data && data.events.length > 0 && (
              <div className="space-y-10">
                {data.events.map((ev) => (
                  <EventBlock
                    key={ev.id}
                    event={ev}
                    generationRun={generationRun}
                    onVariantImage={handleVariantImage}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function CalendarStatusCard({
  isLoading,
  isError,
  error,
  status,
  onRetry,
  onReconnect,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  status?: CalendarStatus;
  onRetry: () => void;
  onReconnect: () => void;
}) {
  const connected = status?.state === "connected";
  return (
    <div
      className={cn(
        "mb-6 rounded-lg border bg-background p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        connected
          ? "border-emerald-500/25"
          : isError || status?.state === "missing-token"
            ? "border-destructive/30"
            : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 size-8 rounded-full flex items-center justify-center shrink-0",
            connected ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive",
          )}
        >
          {connected ? (
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
          ) : (
            <AlertCircle className="size-4" strokeWidth={1.75} />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Calendar integration</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "Checking Google Calendar access..."
              : isError
                ? error instanceof Error
                  ? error.message
                  : "Could not verify Google Calendar access."
                : (status?.message ?? "Calendar status unknown.")}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isLoading}>
          {isLoading ? "Checking..." : "Check again"}
        </Button>
        {!connected && (
          <Button type="button" size="sm" onClick={onReconnect}>
            Reconnect Google
          </Button>
        )}
      </div>
    </div>
  );
}

function EventBlock({
  event,
  generationRun,
  onVariantImage,
}: {
  event: PlannedEvent;
  generationRun: number;
  onVariantImage: (
    eventId: string,
    variantId: string,
    imageUrl: string,
    run: number,
  ) => void | Promise<void>;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(event.variants[0]?.id ?? "");
  const selectedVariant =
    event.variants.find((variant) => variant.id === selectedVariantId) ?? event.variants[0];
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
          {event.end && event.end !== event.start ? ` – ${formatTime(event.end)}` : ""}
        </p>
        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
          {event.summary}
        </h3>
        {event.location && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" strokeWidth={1.75} />
            {event.location}
          </p>
        )}
        {event.variants.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {event.variants.map((variant, index) => (
              <Button
                key={variant.id}
                type="button"
                variant={variant.id === selectedVariant?.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedVariantId(variant.id)}
              >
                {variant.label || `Option ${index + 1}`}
              </Button>
            ))}
          </div>
        )}
        {selectedVariant?.rationale && (
          <p className="mt-4 text-sm leading-relaxed text-foreground/80">
            {selectedVariant.rationale}
          </p>
        )}
        {(!selectedVariant || selectedVariant.outfitIds.length === 0) && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" strokeWidth={1.75} />
            No outfit could be planned for this event.
          </p>
        )}
      </div>
      {selectedVariant && selectedVariant.outfitIds.length > 0 && (
        <OutfitCard
          key={`${event.id}:${selectedVariant.id}:${generationRun}`}
          ids={selectedVariant.outfitIds}
          eventContext={eventContext}
          generationKey={generationRun}
          initialImageUrl={selectedVariant.imageUrl}
          onGenerated={(imageUrl) =>
            onVariantImage(event.id, selectedVariant.id, imageUrl, generationRun)
          }
        />
      )}
    </section>
  );
}
