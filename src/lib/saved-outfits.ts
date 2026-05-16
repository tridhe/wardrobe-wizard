import type { ClosetCategory } from "./closet";
import { supabase } from "@/integrations/supabase/client";
import { getMockUser, mockOwnerKey } from "./mock-user";

const MOCK_SAVED_LIMIT = 8;

export type SavedOutfitItem = {
  id: string;
  name: string;
  category: ClosetCategory;
  detail: string;
  image: string;
};

export type SavedOutfit = {
  id: string;
  imageUrl: string;
  createdAt: string;
  items: SavedOutfitItem[];
};

export function savedOutfitsKey(userId?: string) {
  return userId ? `saved_outfits:${userId}` : "saved_outfits";
}

export function parseSavedOutfits(value?: string | null): SavedOutfit[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeType = meta.match(/data:([^;]+)/)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function compactDataUrl(dataUrl: string, maxSize: number, quality: number): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => resolve(dataUrl.length > 250_000 ? "" : dataUrl);
    image.src = dataUrl;
  });
}

async function compactMockOutfit(outfit: SavedOutfit): Promise<SavedOutfit> {
  return {
    ...outfit,
    imageUrl: await compactDataUrl(outfit.imageUrl, 900, 0.72),
    items: await Promise.all(
      outfit.items.map(async (item) => ({
        ...item,
        image: await compactDataUrl(item.image, 220, 0.62),
      })),
    ),
  };
}

function writeMockOutfits(key: string, outfits: SavedOutfit[]) {
  const attempts: SavedOutfit[][] = [
    outfits.slice(0, MOCK_SAVED_LIMIT),
    outfits.slice(0, 3),
    outfits.slice(0, 1),
    outfits.slice(0, 1).map((outfit) => ({
      ...outfit,
      items: outfit.items.map((item) => ({ ...item, image: "" })),
    })),
  ];

  for (const attempt of attempts) {
    try {
      window.localStorage.setItem(key, JSON.stringify(attempt));
      return;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") {
        throw error;
      }
    }
  }

  throw new Error("Browser storage is full. Delete a few saved looks and try again.");
}

export async function saveGeneratedOutfit({
  imageUrl: inputImageUrl,
  items,
}: {
  imageUrl: string;
  items: SavedOutfitItem[];
}): Promise<SavedOutfit> {
  const mockUser = getMockUser();
  const mockOwner = mockUser ? mockOwnerKey(mockUser) : null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = mockOwner ?? sessionData.session?.user.id;
  const id = crypto.randomUUID();
  let imageUrl = inputImageUrl;

  if (!mockOwner && inputImageUrl.startsWith("data:image/")) {
    const blob = dataUrlToBlob(inputImageUrl);
    const path = `outfits/${userId ?? "anonymous"}/${id}.png`;
    const { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
    if (uploadError) throw uploadError;
    const { data: pub } = supabase.storage.from("wardrobe").getPublicUrl(path);
    imageUrl = pub.publicUrl;
  }

  const key = savedOutfitsKey(userId);
  if (mockOwner) {
    const outfit = await compactMockOutfit({
      id,
      imageUrl,
      createdAt: new Date().toISOString(),
      items,
    });
    const next: SavedOutfit[] = [
      outfit,
      ...parseSavedOutfits(window.localStorage.getItem(key)).slice(0, MOCK_SAVED_LIMIT - 1),
    ];
    writeMockOutfits(key, next);
    return outfit;
  }

  const { data: existing, error: readError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (readError) throw readError;

  const outfit: SavedOutfit = {
    id,
    imageUrl,
    createdAt: new Date().toISOString(),
    items,
  };

  const next: SavedOutfit[] = [outfit, ...parseSavedOutfits(existing?.value).slice(0, 49)];
  const { error: writeError } = await supabase.from("app_settings").upsert({
    key,
    value: JSON.stringify(next),
    updated_at: new Date().toISOString(),
  });
  if (writeError) throw writeError;

  return outfit;
}

export async function deleteSavedOutfit(outfitId: string) {
  const mockUser = getMockUser();
  const mockOwner = mockUser ? mockOwnerKey(mockUser) : null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = mockOwner ?? sessionData.session?.user.id;
  const key = savedOutfitsKey(userId);

  if (mockOwner) {
    const next = parseSavedOutfits(window.localStorage.getItem(key)).filter(
      (outfit) => outfit.id !== outfitId,
    );
    window.localStorage.setItem(key, JSON.stringify(next));
    return;
  }

  const { data: existing, error: readError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (readError) throw readError;

  const next = parseSavedOutfits(existing?.value).filter((outfit) => outfit.id !== outfitId);
  const { error: writeError } = await supabase.from("app_settings").upsert({
    key,
    value: JSON.stringify(next),
    updated_at: new Date().toISOString(),
  });
  if (writeError) throw writeError;
}
