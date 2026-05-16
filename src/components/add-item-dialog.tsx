import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ClosetCategory } from "@/lib/closet";

const CATEGORIES: ClosetCategory[] = ["Tops", "Bottoms", "Dresses", "Shoes", "Outerwear"];

type TagResult = {
  category: ClosetCategory;
  color: string;
  garmentType: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function AddItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory | "">("");
  const [color, setColor] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    setName("");
    setCategory("");
    setColor("");
    setGarmentType("");
    setSaving(false);
  }

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSave() {
    if (!file) {
      toast.error("Add a photo");
      return;
    }
    setSaving(true);
    try {
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
      if (!tagRes.ok) throw new Error(await tagRes.text());
      const tags = (await tagRes.json()) as TagResult;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `items/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("wardrobe")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("wardrobe").getPublicUrl(path);

      const { error: insErr } = await supabase.from("user_items").insert({
        name: name.trim() || `${tags.color} ${tags.garmentType}`.trim(),
        category: tags.category,
        detail: [tags.color, tags.garmentType].filter(Boolean).join(" • "),
        image_url: pub.publicUrl,
      });
      if (insErr) throw insErr;

      toast.success("Added to your closet");
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
          <div className="relative aspect-square w-40 mx-auto rounded-lg border-2 border-dashed border-border hover:border-foreground/40 overflow-hidden bg-muted/30 cursor-pointer flex items-center justify-center text-muted-foreground">
            {preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="size-5" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold tracking-wider uppercase">
                  Choose photo
                </span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
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
            {saving ? "Tagging..." : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}
