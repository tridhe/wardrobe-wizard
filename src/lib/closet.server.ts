import { createClient } from "@supabase/supabase-js";
import type { ClosetTags } from "./closet";

function getServerSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  detail: string;
  imageUrl: string;
  tags: ClosetTags;
  source: "user";
}

function parseTags(value: unknown): ClosetTags {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ClosetTags;
}

export async function loadFullCatalog(): Promise<{
  catalog: CatalogEntry[];
  avatarUrl: string | null;
}> {
  const supabase = getServerSupabase();
  const [itemsRes, settingsRes] = await Promise.all([
    supabase.from("user_items").select("*").order("created_at", { ascending: false }),
    supabase.from("app_settings").select("value").eq("key", "avatar_url").maybeSingle(),
  ]);

  const userEntries: CatalogEntry[] = (itemsRes.data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    detail: r.detail as string,
    imageUrl: r.image_url as string,
    tags: parseTags(r.tags),
    source: "user",
  }));

  return {
    catalog: userEntries,
    avatarUrl: (settingsRes.data?.value as string | undefined) ?? null,
  };
}

export function formatCatalogForPrompt(catalog: CatalogEntry[]): string {
  return catalog
    .map((i) => {
      const tags = [
        i.tags.color,
        i.tags.garmentType,
        i.tags.fit,
        i.tags.material,
        i.tags.pattern,
        i.tags.silhouette,
        i.tags.formality,
        ...(i.tags.season ?? []),
        ...(i.tags.occasions ?? []),
        ...(i.tags.styleTags ?? []),
      ]
        .filter(Boolean)
        .join(", ");
      return `- id:${i.id} | ${i.name} | category:${i.category} | detail:${i.detail}${tags ? ` | tags:${tags}` : ""}`;
    })
    .join("\n");
}
