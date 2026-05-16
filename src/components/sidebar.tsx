import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Compass, Sparkles, Check, Shirt, Calendar, Wand2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { signOutDemo } from "@/lib/demo-auth";

type NavItem =
  | { label: string; icon: typeof Compass; to: "/" | "/stylist" | "/today" | "/styler" }
  | { label: string; icon: typeof Compass; disabled: true };

const navItems: NavItem[] = [
  { label: "Discovery", icon: Compass, disabled: true },
  { label: "Today", icon: Calendar, to: "/today" },
  { label: "Stylist", icon: Sparkles, to: "/stylist" },
  { label: "Styler", icon: Wand2, to: "/styler" },
  { label: "Closet", icon: Check, to: "/" },
  { label: "Outfits", icon: Shirt, disabled: true },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const signOut = async () => {
    signOutDemo();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-background flex-col p-6">
        <div className="mb-10">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Atelier AI</h1>
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground mt-0.5">
            DIGITAL ATELIER
          </p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            if ("disabled" in item) {
              return (
                <button
                  key={item.label}
                  disabled
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground/60 cursor-not-allowed text-left"
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {item.label}
                </button>
              );
            }
            const active = pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 border border-border text-foreground rounded-md py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          Sign out
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        aria-label="Primary"
      >
        <ul className="flex items-stretch justify-around px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            if ("disabled" in item) {
              return (
                <li key={item.label} className="flex-1">
                  <button
                    disabled
                    aria-label={item.label}
                    className="w-full flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-muted-foreground/50"
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                    {item.label}
                  </button>
                </li>
              );
            }
            const active = pathname === item.to;
            return (
              <li key={item.label} className="flex-1">
                <Link
                  to={item.to}
                  aria-label={item.label}
                  className={cn(
                    "w-full flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.25]")} strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
