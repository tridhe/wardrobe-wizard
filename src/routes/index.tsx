import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Bell, ShoppingBag, Plus, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { AddItemDialog } from "@/components/add-item-dialog";
import { AvatarUploader } from "@/components/avatar-uploader";
import { useClosetCatalog } from "@/lib/use-closet";
import { supabase } from "@/integrations/supabase/client";
import { deleteMockClosetItem, mockOwnerKey, useMockUser } from "@/lib/mock-user";
import {
  closetSearchText,
  closetTagValues,
  type ClosetCategory,
  type ClosetItem,
} from "@/lib/closet";

export const Route = createFileRoute("/")({
  component: Closet,
});

type Filter = "All Items" | ClosetCategory;
const categories: Filter[] = ["All Items", "Tops", "Bottoms", "Dresses", "Shoes", "Outerwear"];

function Closet() {
  const queryClient = useQueryClient();
  const mockUser = useMockUser();
  const [active, setActive] = useState<Filter>("All Items");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data } = useClosetCatalog();
  const items = data?.items ?? [];
  const avatarUrl = data?.avatarUrl ?? "";

  const filtered = items.filter((i) => {
    const matchCat = active === "All Items" || i.category === active;
    const matchQuery = !query || closetSearchText(i).includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  async function deleteItem(item: ClosetItem) {
    try {
      if (mockUser) {
        deleteMockClosetItem(mockOwnerKey(mockUser), item.id);
      } else {
        const { error } = await supabase.from("user_items").delete().eq("id", item.id);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["closet-catalog"] });
      toast.success("Removed from closet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete item");
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <Sidebar />
      <main className="flex-1 px-4 py-6 pb-24 md:p-10 md:pb-10 min-w-0">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6 md:mb-8 md:gap-6">
          <div>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
              Your Closet
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              A curated digital archive of your personal style.
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative flex-1 md:flex-none">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search archive..."
                className="bg-muted/60 border border-transparent focus:border-border focus:bg-background rounded-full pl-9 pr-4 py-2 text-sm w-full md:w-64 outline-none transition-colors"
              />
            </div>
            <button
              aria-label="Notifications"
              className="hidden sm:flex size-9 rounded-full hover:bg-accent items-center justify-center text-muted-foreground transition-colors"
            >
              <Bell className="size-4" strokeWidth={1.75} />
            </button>
            <button
              aria-label="Bag"
              className="hidden sm:flex size-9 rounded-full hover:bg-accent items-center justify-center text-muted-foreground transition-colors"
            >
              <ShoppingBag className="size-4" strokeWidth={1.75} />
            </button>
            {avatarUrl && <AvatarUploader src={avatarUrl} />}
          </div>
        </header>

        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={cn(
                  "px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase border transition-all",
                  active === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-foreground/40",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {avatarUrl && <AvatarUploader src={avatarUrl} label="Upload user photo" />}
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-4" strokeWidth={2} />
              Add New
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          <button onClick={() => setDialogOpen(true)} className="group text-left">
            <div className="aspect-square rounded-lg border-2 border-dashed border-border group-hover:border-foreground/40 group-hover:bg-accent/30 flex flex-col items-center justify-center text-muted-foreground transition-colors">
              <Upload
                className="size-6 mb-2 group-hover:text-foreground transition-colors"
                strokeWidth={1.5}
              />
              <span className="text-[10px] font-semibold tracking-wider uppercase">
                Upload Image
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-foreground">New Item</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Archive a new piece</p>
            </div>
          </button>

          {filtered.map((item) => (
            <ClosetItemCard key={item.id} item={item} onDelete={() => deleteItem(item)} />
          ))}
        </div>
      </main>
      <AddItemDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function ClosetItemCard({ item, onDelete }: { item: ClosetItem; onDelete: () => void }) {
  const tagChips = closetTagValues(item.tags)
    .filter((tag) => !item.detail.toLowerCase().includes(tag.toLowerCase()))
    .slice(0, 3);

  return (
    <article className="group">
      <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
        <img
          src={item.image}
          alt={item.name}
          width={512}
          height={512}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
        {item.badge && (
          <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded">
            {item.badge}
          </span>
        )}
        <button
          type="button"
          aria-label={`Delete ${item.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90 text-destructive opacity-100 shadow-sm transition-colors hover:bg-background md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.category}
          {item.detail ? ` • ${item.detail}` : ""}
        </p>
        {tagChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tagChips.map((tag) => (
              <span
                key={tag}
                className="rounded bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
