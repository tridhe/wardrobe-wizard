import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { closetItems, type ClosetItem, type ClosetCategory } from "./closet";
import staticAvatar from "@/assets/avatar.jpg";

export interface DbUserItem {
  id: string;
  name: string;
  category: string;
  detail: string;
  image_url: string;
  created_at: string;
}

function toClosetItem(r: DbUserItem): ClosetItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category as ClosetCategory,
    detail: r.detail,
    image: r.image_url,
  };
}

export function useClosetCatalog() {
  return useQuery({
    queryKey: ["closet-catalog"],
    queryFn: async () => {
      const [itemsRes, settingsRes] = await Promise.all([
        supabase
          .from("user_items")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "avatar_url")
          .maybeSingle(),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      const userItems = (itemsRes.data ?? []).map(toClosetItem);
      const all: ClosetItem[] = [...userItems, ...closetItems];
      const avatarUrl = settingsRes.data?.value ?? staticAvatar;
      return { items: all, userItems, avatarUrl };
    },
  });
}

export function findItem(items: ClosetItem[], id: string): ClosetItem | undefined {
  return items.find((i) => i.id === id);
}
