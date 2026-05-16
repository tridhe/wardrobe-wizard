import itemCoat from "@/assets/item-coat.jpg";
import itemDress from "@/assets/item-dress.jpg";
import itemSneaker from "@/assets/item-sneaker.jpg";
import itemKnit from "@/assets/item-knit.jpg";
import itemDenim from "@/assets/item-denim.jpg";
import itemShirt from "@/assets/item-shirt.jpg";
import itemBlazer from "@/assets/item-blazer.jpg";
import itemTrousers from "@/assets/item-trousers.jpg";
import itemBoot from "@/assets/item-boot.jpg";

export type ClosetCategory = "Tops" | "Bottoms" | "Dresses" | "Shoes" | "Outerwear";

export interface ClosetItem {
  id: string;
  name: string;
  category: ClosetCategory;
  detail: string;
  image: string;
  badge?: string;
}

export const closetItems: ClosetItem[] = [
  { id: "coat", name: "Wool Tailored Coat", category: "Outerwear", detail: "Charcoal Gray", image: itemCoat, badge: "AI RECOMMENDED" },
  { id: "dress", name: "Silk Slip Dress", category: "Dresses", detail: "Onyx Black", image: itemDress },
  { id: "sneaker", name: "Pristine Sneaker", category: "Shoes", detail: "Optic White", image: itemSneaker },
  { id: "knit", name: "Oatmeal Knit", category: "Tops", detail: "Beige", image: itemKnit },
  { id: "denim", name: "Straight Leg Denim", category: "Bottoms", detail: "Indigo", image: itemDenim },
  { id: "shirt", name: "Poplin Shirt", category: "Tops", detail: "White", image: itemShirt },
  { id: "blazer", name: "Evening Blazer", category: "Outerwear", detail: "Black", image: itemBlazer },
  { id: "trousers", name: "Wide Leg Trousers", category: "Bottoms", detail: "Camel", image: itemTrousers },
  { id: "boot", name: "Chelsea Boot", category: "Shoes", detail: "Matte Black", image: itemBoot },
];

export const closetCatalogForPrompt = closetItems
  .map((i) => `- id:${i.id} | ${i.name} (${i.category}, ${i.detail})`)
  .join("\n");
