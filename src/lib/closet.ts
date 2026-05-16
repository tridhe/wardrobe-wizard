export type ClosetCategory = "Tops" | "Bottoms" | "Dresses" | "Shoes" | "Outerwear";

export interface ClosetTags {
  color?: string;
  garmentType?: string;
  fit?: string;
  material?: string;
  pattern?: string;
  silhouette?: string;
  formality?: string;
  season?: string[];
  occasions?: string[];
  styleTags?: string[];
}

export interface ClosetItem {
  id: string;
  name: string;
  category: ClosetCategory;
  detail: string;
  image: string;
  tags?: ClosetTags;
  badge?: string;
}

export function closetTagValues(tags?: ClosetTags): string[] {
  if (!tags) return [];
  return [
    tags.color,
    tags.garmentType,
    tags.fit,
    tags.material,
    tags.pattern,
    tags.silhouette,
    tags.formality,
    ...(tags.season ?? []),
    ...(tags.occasions ?? []),
    ...(tags.styleTags ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));
}

export function closetSearchText(item: ClosetItem): string {
  return [item.name, item.category, item.detail, ...closetTagValues(item.tags)]
    .join(" ")
    .toLowerCase();
}
