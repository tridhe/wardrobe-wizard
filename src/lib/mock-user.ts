import { useEffect, useSyncExternalStore } from "react";
import type { Json } from "@/integrations/supabase/types";

const STORAGE_KEY = "atelier_mock_user_id";
const CLOSET_PREFIX = "atelier_mock_closet:";
const AVATAR_PREFIX = "atelier_mock_avatar:";
const MOCK_CLOSET_LIMIT = 80;

export type MockUser = {
  id: string;
  name: string;
  email: string;
};

export type MockClosetItem = {
  id: string;
  name: string;
  category: string;
  detail: string;
  image_url: string;
  tags?: Json;
  user_id: null;
  owner_name: string;
  created_at: string;
};

export const mockUsers: MockUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex",
    email: "alex.demo@atelier.local",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Jordan",
    email: "jordan.demo@atelier.local",
  },
];

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("atelier-mock-user-change"));
}

export function getMockUserId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function getMockUser() {
  const id = getMockUserId();
  return mockUsers.find((user) => user.id === id) ?? null;
}

export function setMockUser(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
  emitChange();
}

export function clearMockUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitChange();
}

export function mockOwnerKey(user: MockUser) {
  return `mock:${user.id}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  emitChange();
}

export function getMockClosetItems(ownerKey: string): MockClosetItem[] {
  return readJson<MockClosetItem[]>(`${CLOSET_PREFIX}${ownerKey}`, []);
}

export function addMockClosetItems(ownerKey: string, items: MockClosetItem[]) {
  const existing = getMockClosetItems(ownerKey);
  const key = `${CLOSET_PREFIX}${ownerKey}`;
  const next = [...items, ...existing].slice(0, MOCK_CLOSET_LIMIT);
  const attempts: MockClosetItem[][] = [next, [...items, ...existing.slice(0, 10)], items];

  for (const attempt of attempts) {
    try {
      writeJson(key, attempt);
      return;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") {
        throw error;
      }
    }
  }

  throw new Error("Browser storage is full. Delete a few demo closet items and try again.");
}

export function deleteMockClosetItem(ownerKey: string, itemId: string) {
  const existing = getMockClosetItems(ownerKey);
  writeJson(
    `${CLOSET_PREFIX}${ownerKey}`,
    existing.filter((item) => item.id !== itemId),
  );
}

export function updateMockClosetItem(
  ownerKey: string,
  itemId: string,
  patch: Partial<Pick<MockClosetItem, "name" | "category" | "detail" | "tags">>,
) {
  const existing = getMockClosetItems(ownerKey);
  writeJson(
    `${CLOSET_PREFIX}${ownerKey}`,
    existing.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  );
}

export function getMockAvatarUrl(ownerKey: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${AVATAR_PREFIX}${ownerKey}`);
}

export function setMockAvatarUrl(ownerKey: string, imageUrl: string) {
  if (typeof window === "undefined") return;
  const key = `${AVATAR_PREFIX}${ownerKey}`;
  try {
    window.localStorage.setItem(key, imageUrl);
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") {
      throw error;
    }
    window.localStorage.removeItem(key);
    window.localStorage.setItem(key, imageUrl);
  }
  emitChange();
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("atelier-mock-user-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("atelier-mock-user-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function snapshot() {
  return getMockUserId();
}

export function useMockUser() {
  const id = useSyncExternalStore(subscribe, snapshot, () => null);
  const user = mockUsers.find((candidate) => candidate.id === id) ?? null;

  useEffect(() => {
    if (!id) return;
    if (!user) clearMockUser();
  }, [id, user]);

  return user;
}
