import { createClient } from "@supabase/supabase-js";
import { closetItems, type ClosetItem, type ClosetCategory } from "./closet";

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
  source: "static" | "user";
}

export async function loadFullCatalog(): Promise<{
  catalog: CatalogEntry[];
  avatarUrl: string | null;
}> {
  const supabase = getServerSupabase();
  const [itemsRes, settingsRes] = await Promise.all([
    supabase.from("user_items").select("*").order("created_at", { ascending: false }),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "avatar_url")
      .maybeSingle(),
  ]);

  const userEntries: CatalogEntry[] = (itemsRes.data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    detail: r.detail as string,
    imageUrl: r.image_url as string,
    source: "user",
  }));

  const staticEntries: CatalogEntry[] = closetItems.map((i: ClosetItem) => ({
    id: i.id,
    name: i.name,
    category: i.category as ClosetCategory,
    detail: i.detail,
    imageUrl: i.image, // imported asset URL (relative in dev/prod)
    source: "static",
  }));

  return {
    catalog: [...userEntries, ...staticEntries],
    avatarUrl: (settingsRes.data?.value as string | undefined) ?? null,
  };
}

export function formatCatalogForPrompt(catalog: CatalogEntry[]): string {
  return catalog
    .map((i) => `- id:${i.id} | ${i.name} (${i.category}, ${i.detail})`)
    .join("\n");
}
