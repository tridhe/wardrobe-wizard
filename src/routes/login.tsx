import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { mockUsers, setMockUser, useMockUser } from "@/lib/mock-user";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in - Aura" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const mockUser = useMockUser();

  useEffect(() => {
    if (mockUser) {
      navigate({ to: "/" });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/today" });
    });
  }, [mockUser, navigate]);

  const signIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/today`,
      extraParams: {
        scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        access_type: "offline",
        prompt: "consent",
      },
    });
    if (result.error) {
      toast.error(result.error.message ?? "Sign in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/today" });
  };

  const signInAsMock = (id: string) => {
    setMockUser(id);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-10 shadow-sm text-center">
        <div className="size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6">
          <Sparkles className="size-5" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Aura</h1>
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground mt-1 uppercase">
          Personal Style AI
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Sign in with Google to style your day.
        </p>
        <button
          onClick={signIn}
          disabled={loading}
          className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-md border border-border bg-background hover:bg-accent transition-colors py-3 text-sm font-medium text-foreground disabled:opacity-50"
        >
          <GoogleIcon />
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
        <div className="mt-6 border-t border-border pt-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Demo mode
          </p>
          <div className="mt-3 grid gap-2">
            {mockUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => signInAsMock(user.id)}
                className="inline-flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent"
              >
                <span className="inline-flex items-center gap-2">
                  <UserRound className="size-4" />
                  Continue as {user.name}
                </span>
                <span className="text-[11px] text-muted-foreground">Mock</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground">
          Use mock users for demos, or Google for real account access.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"
      />
    </svg>
  );
}
