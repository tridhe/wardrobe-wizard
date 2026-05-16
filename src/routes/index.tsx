import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Compass, Sparkles, Check, Shirt, Search, Bell, ShoppingBag, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import avatar from "@/assets/avatar.jpg";
import itemCoat from "@/assets/item-coat.jpg";
import itemDress from "@/assets/item-dress.jpg";
import itemSneaker from "@/assets/item-sneaker.jpg";
import itemKnit from "@/assets/item-knit.jpg";
import itemDenim from "@/assets/item-denim.jpg";
import itemShirt from "@/assets/item-shirt.jpg";
import itemBlazer from "@/assets/item-blazer.jpg";
import itemTrousers from "@/assets/item-trousers.jpg";
import itemBoot from "@/assets/item-boot.jpg";

export const Route = createFileRoute("/")({
  component: Closet,
});

type Category = "All Items" | "Tops" | "Bottoms" | "Dresses" | "Shoes" | "Outerwear";

interface Item {
  id: string;
  name: string;
  category: Exclude<Category, "All Items">;
  detail: string;
  image: string;
  badge?: string;
}

const items: Item[] = [
  { id: "1", name: "Wool Tailored Coat", category: "Outerwear", detail: "Charcoal Gray", image: itemCoat, badge: "AI RECOMMENDED" },
  { id: "2", name: "Silk Slip Dress", category: "Dresses", detail: "Onyx Black", image: itemDress },
  { id: "3", name: "Pristine Sneaker", category: "Shoes", detail: "Optic White", image: itemSneaker },
  { id: "4", name: "Oatmeal Knit", category: "Tops", detail: "Beige", image: itemKnit },
  { id: "5", name: "Straight Leg Denim", category: "Bottoms", detail: "Indigo", image: itemDenim },
  { id: "6", name: "Poplin Shirt", category: "Tops", detail: "White", image: itemShirt },
  { id: "7", name: "Evening Blazer", category: "Outerwear", detail: "Black", image: itemBlazer },
  { id: "8", name: "Wide Leg Trousers", category: "Bottoms", detail: "Camel", image: itemTrousers },
  { id: "9", name: "Chelsea Boot", category: "Shoes", detail: "Matte Black", image: itemBoot },
];

const categories: Category[] = ["All Items", "Tops", "Bottoms", "Dresses", "Shoes", "Outerwear"];

const navItems = [
  { label: "Discovery", icon: Compass },
  { label: "Stylist", icon: Sparkles },
  { label: "Closet", icon: Check },
  { label: "Outfits", icon: Shirt },
];

function Closet() {
  const [active, setActive] = useState<Category>("All Items");
  const [activeNav, setActiveNav] = useState("Closet");
  const [query, setQuery] = useState("");

  const filtered = items.filter((i) => {
    const matchCat = active === "All Items" || i.category === active;
    const matchQuery = !query || i.name.toLowerCase().includes(query.toLowerCase()) || i.detail.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="min-h-screen bg-muted/40 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-background flex flex-col p-6">
        <div className="mb-10">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Atelier AI</h1>
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground mt-0.5">DIGITAL ATELIER</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setActiveNav(label)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-colors",
                activeNav === label
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </nav>
        <button className="bg-primary text-primary-foreground rounded-md py-3 text-sm font-medium hover:bg-primary/90 transition-colors">
          Book Consultation
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-10">
        {/* Header */}
        <header className="flex items-start justify-between mb-8 gap-6">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground">Your Closet</h2>
            <p className="text-sm text-muted-foreground mt-1.5">A curated digital archive of your personal style.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" strokeWidth={1.75} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search archive..."
                className="bg-muted/60 border border-transparent focus:border-border focus:bg-background rounded-full pl-9 pr-4 py-2 text-sm w-64 outline-none transition-colors"
              />
            </div>
            <button className="size-9 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors">
              <Bell className="size-4" strokeWidth={1.75} />
            </button>
            <button className="size-9 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors">
              <ShoppingBag className="size-4" strokeWidth={1.75} />
            </button>
            <img src={avatar} alt="Profile" width={36} height={36} className="size-9 rounded-full object-cover" loading="lazy" />
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={cn(
                  "px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase border transition-all",
                  active === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-foreground/40",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="size-4" strokeWidth={2} />
            Add New
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {filtered.map((item) => (
            <article key={item.id} className="group cursor-pointer">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={item.image}
                  alt={item.name}
                  width={512}
                  height={512}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
                {item.badge && (
                  <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.category} • {item.detail}
                </p>
              </div>
            </article>
          ))}

          {/* Upload tile */}
          <button className="group text-left">
            <div className="aspect-square rounded-lg border-2 border-dashed border-border group-hover:border-foreground/40 group-hover:bg-accent/30 flex flex-col items-center justify-center text-muted-foreground transition-colors">
              <Upload className="size-6 mb-2 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
              <span className="text-[10px] font-semibold tracking-wider uppercase">Upload Image</span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-foreground">New Item</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Archive a new piece</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
