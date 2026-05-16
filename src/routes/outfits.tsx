import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shirt, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteSavedOutfit,
  parseSavedOutfits,
  savedOutfitsKey,
  type SavedOutfit,
} from "@/lib/saved-outfits";
import { mockOwnerKey, useMockUser } from "@/lib/mock-user";

export const Route = createFileRoute("/outfits")({
  head: () => ({
    meta: [
      { title: "Outfits — Aura" },
      { name: "description", content: "Saved generated outfits." },
    ],
  }),
  component: OutfitsPage,
});

async function fetchSavedOutfits(mockOwner?: string | null): Promise<SavedOutfit[]> {
  if (mockOwner) {
    return parseSavedOutfits(window.localStorage.getItem(savedOutfitsKey(mockOwner)));
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const key = savedOutfitsKey(sessionData.session?.user.id);
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return parseSavedOutfits(data?.value);
}

function OutfitsPage() {
  const queryClient = useQueryClient();
  const mockUser = useMockUser();
  const mockOwner = mockUser ? mockOwnerKey(mockUser) : null;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["saved-outfits", mockOwner],
    queryFn: () => fetchSavedOutfits(mockOwner),
  });
  const outfits = data ?? [];

  async function deleteLook(outfit: SavedOutfit) {
    try {
      await deleteSavedOutfit(outfit.id);
      await queryClient.invalidateQueries({ queryKey: ["saved-outfits"] });
      toast.success("Deleted saved look");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete saved look");
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <header className="px-4 pt-6 pb-4 md:px-10 md:pt-10 md:pb-6 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Shirt className="size-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Outfits
              </h2>
              <p className="text-sm text-muted-foreground">
                Saved generated looks from the Styler.
              </p>
            </div>
          </div>
        </header>

        <div className="px-4 py-6 md:px-10 md:py-8">
          {isLoading && (
            <div className="py-20 flex justify-center text-sm text-muted-foreground">
              Loading saved outfits...
            </div>
          )}

          {isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load outfits"}
            </div>
          )}

          {!isLoading && !isError && outfits.length === 0 && (
            <div className="rounded-lg border border-border bg-background p-10 text-center">
              <Sparkles className="size-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-foreground">No saved outfits yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Build and save a generated look in Styler.
              </p>
              <Button asChild className="mt-5">
                <Link to="/styler">Open Styler</Link>
              </Button>
            </div>
          )}

          {outfits.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {outfits.map((outfit) => (
                <article
                  key={outfit.id}
                  className="group rounded-lg border border-border bg-background overflow-hidden"
                >
                  <div className="relative aspect-[3/4] bg-muted">
                    <img
                      src={outfit.imageUrl}
                      alt="Saved outfit"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Delete saved look"
                      onClick={() => deleteLook(outfit)}
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90 text-destructive opacity-100 shadow-sm transition-colors hover:bg-background md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                      {new Date(outfit.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {outfit.items.slice(0, 4).map((item) => (
                        <div key={item.id} className="space-y-1">
                          <div className="aspect-square rounded-md bg-muted overflow-hidden">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] font-medium text-foreground truncate">
                            {item.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
