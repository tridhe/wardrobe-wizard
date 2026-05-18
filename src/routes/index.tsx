import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Search, Bell, ShoppingBag, Plus, Upload, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { AddItemDialog } from "@/components/add-item-dialog";
import { AvatarUploader } from "@/components/avatar-uploader";
import { useClosetCatalog } from "@/lib/use-closet";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteMockClosetItem,
  mockOwnerKey,
  updateMockClosetItem,
  useMockUser,
} from "@/lib/mock-user";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  closetSearchText,
  closetTagValues,
  type ClosetCategory,
  type ClosetItem,
  type ClosetTags,
} from "@/lib/closet";

export const Route = createFileRoute("/")({
  component: Closet,
});

type Filter = "All Items" | ClosetCategory;
const categories: Filter[] = ["All Items", "Tops", "Bottoms", "Dresses", "Shoes", "Outerwear"];
const editableCategories = categories.filter((cat): cat is ClosetCategory => cat !== "All Items");

type EditItemValues = {
  name: string;
  category: ClosetCategory;
  color: string;
  garmentType: string;
  fit: string;
  material: string;
  pattern: string;
  silhouette: string;
  formality: string;
  season: string;
  occasions: string;
  styleTags: string;
};

function joinList(values?: string[]) {
  return values?.join(", ") ?? "";
}

function splitList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function formFromItem(item: ClosetItem): EditItemValues {
  return {
    name: item.name,
    category: item.category,
    color: item.tags?.color ?? "",
    garmentType: item.tags?.garmentType ?? "",
    fit: item.tags?.fit ?? "",
    material: item.tags?.material ?? "",
    pattern: item.tags?.pattern ?? "",
    silhouette: item.tags?.silhouette ?? "",
    formality: item.tags?.formality ?? "",
    season: joinList(item.tags?.season),
    occasions: joinList(item.tags?.occasions),
    styleTags: joinList(item.tags?.styleTags),
  };
}

function tagsFromForm(values: EditItemValues): ClosetTags {
  return {
    color: clean(values.color),
    garmentType: clean(values.garmentType),
    fit: clean(values.fit),
    material: clean(values.material),
    pattern: clean(values.pattern),
    silhouette: clean(values.silhouette),
    formality: clean(values.formality),
    season: splitList(values.season),
    occasions: splitList(values.occasions),
    styleTags: splitList(values.styleTags),
  };
}

function detailFromTags(tags: ClosetTags) {
  return [tags.color, tags.garmentType, tags.fit].filter(Boolean).join(" • ");
}

function Closet() {
  const queryClient = useQueryClient();
  const mockUser = useMockUser();
  const [active, setActive] = useState<Filter>("All Items");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
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

  async function updateItem(item: ClosetItem, values: EditItemValues) {
    const tags = tagsFromForm(values);
    const patch = {
      name: values.name.trim() || item.name,
      category: values.category,
      detail: detailFromTags(tags),
      tags,
    };

    try {
      if (mockUser) {
        updateMockClosetItem(mockOwnerKey(mockUser), item.id, patch);
      } else {
        const { error } = await supabase.from("user_items").update(patch).eq("id", item.id);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["closet-catalog"] });
      setEditingItem(null);
      toast.success("Updated closet tags");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update item");
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
            <ClosetItemCard
              key={item.id}
              item={item}
              onDelete={() => deleteItem(item)}
              onEdit={() => setEditingItem(item)}
            />
          ))}
        </div>
      </main>
      <AddItemDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <EditItemDialog
        item={editingItem}
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        onSave={updateItem}
      />
    </div>
  );
}

function ClosetItemCard({
  item,
  onDelete,
  onEdit,
}: {
  item: ClosetItem;
  onDelete: () => void;
  onEdit: () => void;
}) {
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
          aria-label={`Edit ${item.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit();
          }}
          className="absolute left-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground opacity-100 shadow-sm transition-colors hover:bg-background md:opacity-0 md:group-hover:opacity-100"
        >
          <Pencil className="size-4" strokeWidth={1.75} />
        </button>
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

function EditItemDialog({
  item,
  open,
  onOpenChange,
  onSave,
}: {
  item: ClosetItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: ClosetItem, values: EditItemValues) => Promise<void>;
}) {
  const [values, setValues] = useState<EditItemValues | null>(item ? formFromItem(item) : null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(item ? formFromItem(item) : null);
  }, [item]);

  if (!item || !values) return null;

  const update = <K extends keyof EditItemValues>(key: K, value: EditItemValues[K]) => {
    setValues((current) => (current ? { ...current, [key]: value } : current));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(item, values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit closet item</DialogTitle>
          <DialogDescription>Keep this piece easy to find and style.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <img
              src={item.image}
              alt={item.name}
              className="aspect-square w-full rounded-lg bg-muted object-cover"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Name
                </span>
                <Input
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </span>
                <select
                  value={values.category}
                  onChange={(event) => update("category", event.target.value as ClosetCategory)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {editableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Color"
                value={values.color}
                onChange={(value) => update("color", value)}
              />
              <TextField
                label="Garment"
                value={values.garmentType}
                onChange={(value) => update("garmentType", value)}
                placeholder="t-shirt, jeans, blazer"
              />
              <TextField
                label="Fit"
                value={values.fit}
                onChange={(value) => update("fit", value)}
              />
              <TextField
                label="Material"
                value={values.material}
                onChange={(value) => update("material", value)}
              />
              <TextField
                label="Pattern"
                value={values.pattern}
                onChange={(value) => update("pattern", value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Silhouette"
              value={values.silhouette}
              onChange={(value) => update("silhouette", value)}
            />
            <TextField
              label="Formality"
              value={values.formality}
              onChange={(value) => update("formality", value)}
              placeholder="casual, smart casual, formal"
            />
            <TextAreaField
              label="Season"
              value={values.season}
              onChange={(value) => update("season", value)}
              placeholder="spring, summer"
            />
            <TextAreaField
              label="Occasions"
              value={values.occasions}
              onChange={(value) => update("occasions", value)}
              placeholder="date night, office, travel"
            />
            <TextAreaField
              label="Style Tags"
              value={values.styleTags}
              onChange={(value) => update("styleTags", value)}
              placeholder="minimal, streetwear, classic"
              className="sm:col-span-2"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save tags"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("space-y-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-20"
      />
    </label>
  );
}
