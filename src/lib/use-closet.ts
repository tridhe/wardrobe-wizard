import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type ClosetItem, type ClosetCategory, type ClosetTags } from "./closet";
import staticAvatar from "@/assets/avatar.jpg";
import { getMockAvatarUrl, getMockClosetItems, mockOwnerKey, useMockUser } from "./mock-user";

export interface DbUserItem {
  id: string;
  name: string;
  category: string;
  detail: string;
  image_url: string;
  tags?: unknown;
  user_id?: string | null;
  owner_name?: string | null;
  created_at: string;
}

function parseTags(value: unknown): ClosetTags | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as ClosetTags;
}

function toClosetItem(r: DbUserItem): ClosetItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category as ClosetCategory,
    detail: r.detail,
    image: r.image_url,
    tags: parseTags(r.tags),
  };
}

export function useClosetCatalog() {
  const mockUser = useMockUser();
  const mockUserId = mockUser?.id ?? null;
  return useQuery({
    queryKey: ["closet-catalog", mockUserId],
    queryFn: async () => {
      if (mockUser) {
        const ownerKey = mockOwnerKey(mockUser);
        const userItems = getMockClosetItems(ownerKey).map(toClosetItem);
        return {
          items: userItems,
          userItems,
          avatarUrl: getMockAvatarUrl(ownerKey) ?? staticAvatar,
        };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const avatarKey = userId ? `avatar_url:${userId}` : "avatar_url";

      const [itemsRes, userAvatarRes, fallbackAvatarRes] = await Promise.all([
        supabase.from("user_items").select("*").order("created_at", { ascending: false }),
        supabase.from("app_settings").select("value").eq("key", avatarKey).maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "avatar_url").maybeSingle(),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      const rows = (itemsRes.data ?? []) as DbUserItem[];
      const hasOwnership = rows.some((row) => "user_id" in row && row.user_id);
      const visibleRows =
        userId && hasOwnership
          ? rows.filter((row) => !("user_id" in row) || !row.user_id || row.user_id === userId)
          : rows.filter((row) => !row.owner_name?.startsWith("mock:"));
      const userItems = visibleRows.map(toClosetItem);
      const avatarUrl = userAvatarRes.data?.value ?? fallbackAvatarRes.data?.value ?? staticAvatar;
      return { items: userItems, userItems, avatarUrl };
    },
  });
}

export function findItem(items: ClosetItem[], id: string): ClosetItem | undefined {
  return items.find((i) => i.id === id);
}
