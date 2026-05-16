import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Sparkles, Check, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Discovery", icon: Compass, to: "/discovery" as const },
  { label: "Stylist", icon: Sparkles, to: "/stylist" as const },
  { label: "Closet", icon: Check, to: "/" as const },
  { label: "Outfits", icon: Shirt, to: "/outfits" as const },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-background flex flex-col p-6">
      <div className="mb-10">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Atelier AI</h1>
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground mt-0.5">
          DIGITAL ATELIER
        </p>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ label, icon: Icon, to }) => {
          const active = pathname === to;
          return (
            <Link
              key={label}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <button className="bg-primary text-primary-foreground rounded-md py-3 text-sm font-medium hover:bg-primary/90 transition-colors">
        Book Consultation
      </button>
    </aside>
  );
}
