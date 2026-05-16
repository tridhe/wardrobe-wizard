import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ClosetCategory, ClosetTags } from "@/lib/closet";
import {
  addMockClosetItems,
  mockOwnerKey,
  useMockUser,
  type MockClosetItem,
} from "@/lib/mock-user";

const CATEGORIES: ClosetCategory[] = ["Tops", "Bottoms", "Dresses", "Shoes", "Outerwear"];

type TagResult = {
  category: ClosetCategory;
  color: string;
  garmentType: string;
  fit: string;
  material: string;
  pattern: string;
  silhouette: string;
  formality: string;
  season: string[];
  occasions: string[];
  styleTags: string[];
};

type InsertRow = {
  name: string;
  category: ClosetCategory;
  detail: string;
  image_url: string;
  tags?: Json;
  user_id?: string | null;
  owner_name?: string | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function compressClosetPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxSize = 720;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.68));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    image.src = url;
  });
}

function fallbackTags(
  file: File,
  values: { category: ClosetCategory | ""; color: string; garmentType: string },
): TagResult {
  return {
    category: values.category || "Tops",
    color: values.color.trim() || "Unknown color",
    garmentType: values.garmentType.trim() || file.name.replace(/\.[^.]+$/, "") || "Clothing item",
    fit: "",
    material: "",
    pattern: "",
    silhouette: "",
    formality: "",
    season: [],
    occasions: [],
    styleTags: [],
  };
}

type OptionalInsertColumn = "tags" | "user_id" | "owner_name";

function missingColumn(error: unknown): OptionalInsertColumn | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: string; message?: string };
  if (candidate.code !== "PGRST204" && !candidate.message?.toLowerCase().includes("schema cache")) {
    return null;
  }
  const message = candidate.message?.toLowerCase() ?? "";
  if (message.includes("tags")) return "tags";
  if (message.includes("user_id")) return "user_id";
  if (message.includes("owner_name")) return "owner_name";
  return null;
}

async function insertRows(rows: InsertRow[]) {
  const skipped = new Set<string>();
  let nextRows = rows;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await supabase.from("user_items").insert(nextRows);
    if (!error)
      return { richTagsSaved: !skipped.has("tags"), ownershipSaved: !skipped.has("user_id") };

    const column = missingColumn(error);
    if (!column || skipped.has(column)) throw error;

    skipped.add(column);
    nextRows = nextRows.map(({ [column]: _missing, ...row }) => row);
  }

  throw new Error("Could not insert closet items");
}

export function AddItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const mockUser = useMockUser();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory | "">("");
  const [color, setColor] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
    setName("");
    setCategory("");
    setColor("");
    setGarmentType("");
    setSaving(false);
  }

  function pickFiles(nextFiles: FileList | null) {
    previews.forEach((url) => URL.revokeObjectURL(url));
    const selected = Array.from(nextFiles ?? []);
    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
  }

  async function handleSave() {
    if (files.length === 0) {
      toast.error("Add at least one photo");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const mockOwner = mockUser ? mockOwnerKey(mockUser) : null;
      const rows: InsertRow[] = [];
      const mockRows: MockClosetItem[] = [];
      let autoTaggingFailed = false;

      for (const file of files) {
        const imageUrl = await fileToDataUrl(file);
        const tagRes = await fetch("/api/tag-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl,
            category: category || undefined,
            color: color.trim() || undefined,
            garmentType: garmentType.trim() || undefined,
          }),
        });
        const tags = tagRes.ok
          ? ((await tagRes.json()) as TagResult)
          : fallbackTags(file, { category, color, garmentType });
        if (!tagRes.ok) autoTaggingFailed = true;

        const itemName = name.trim() || `${tags.color} ${tags.garmentType}`.trim();
        const detail = [tags.color, tags.garmentType, tags.fit].filter(Boolean).join(" • ");
        const itemTags = {
          color: tags.color,
          garmentType: tags.garmentType,
          fit: tags.fit,
          material: tags.material,
          pattern: tags.pattern,
          silhouette: tags.silhouette,
          formality: tags.formality,
          season: tags.season,
          occasions: tags.occasions,
          styleTags: tags.styleTags,
          ...(mockOwner ? { mockUserId: mockOwner } : {}),
        } satisfies ClosetTags & { mockUserId?: string };

        if (mockOwner) {
          mockRows.push({
            id: crypto.randomUUID(),
            name: itemName,
            category: tags.category,
            detail,
            image_url: await compressClosetPreview(file),
            user_id: null,
            owner_name: mockOwner,
            tags: itemTags,
            created_at: new Date().toISOString(),
          });
        } else {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `items/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("wardrobe")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("wardrobe").getPublicUrl(path);

          rows.push({
            name: itemName,
            category: tags.category,
            detail,
            image_url: pub.publicUrl,
            user_id: user?.id ?? null,
            owner_name:
              user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? null,
            tags: itemTags,
          });
        }
      }

      const insertResult = mockOwner
        ? { richTagsSaved: true, ownershipSaved: true }
        : await insertRows(rows);
      if (mockOwner) addMockClosetItems(mockOwner, mockRows);

      toast.success(files.length === 1 ? "Added to your closet" : `Added ${files.length} items`);
      if (autoTaggingFailed) {
        toast.warning("Uploaded with basic tags because auto-tagging failed");
      }
      if (!insertResult.richTagsSaved) {
        toast.warning("Uploaded, but rich tags need the Supabase tags column migration");
      }
      if (!insertResult.ownershipSaved) {
        toast.warning("Uploaded, but user-owned closets need the ownership migration");
      }
      qc.invalidateQueries({ queryKey: ["closet-catalog"] });
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-background rounded-2xl border border-border max-w-lg w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold tracking-tight">Add to your closet</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          Upload a clean product shot — it works best with a plain background.
        </p>

        <label className="block">
          <div className="relative min-h-40 w-full rounded-lg border-2 border-dashed border-border hover:border-foreground/40 overflow-hidden bg-muted/30 cursor-pointer flex items-center justify-center text-muted-foreground p-3">
            {previews.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 w-full">
                {previews.slice(0, 8).map((preview, index) => (
                  <div key={preview} className="aspect-square rounded-md overflow-hidden bg-muted">
                    <img
                      src={preview}
                      alt={`Selected item ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {previews.length > 8 && (
                  <div className="aspect-square rounded-md bg-background/80 border border-border flex items-center justify-center text-xs font-medium text-foreground">
                    +{previews.length - 8}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="size-5" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold tracking-wider uppercase">
                  Choose photos
                </span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => pickFiles(e.target.files)}
            />
          </div>
        </label>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
              Name optional
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Favorite white tee"
              className="mt-1 w-full bg-muted/60 border border-transparent focus:border-border focus:bg-background rounded-md px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ClosetCategory)}
                className="mt-1 w-full bg-muted/60 border border-transparent focus:border-border focus:bg-background rounded-md px-3 py-2 text-sm outline-none"
              >
                <option value="">Auto-detect</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Color
              </label>
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Auto-detect"
                className="mt-1 w-full bg-muted/60 border border-transparent focus:border-border focus:bg-background rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
              Garment type
            </label>
            <input
              value={garmentType}
              onChange={(e) => setGarmentType(e.target.value)}
              placeholder="Auto-detect, e.g. t-shirt, jeans, blazer"
              className="mt-1 w-full bg-muted/60 border border-transparent focus:border-border focus:bg-background rounded-md px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Tagging..." : files.length > 1 ? `Add ${files.length} items` : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}
