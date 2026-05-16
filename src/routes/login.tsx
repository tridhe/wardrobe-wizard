import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — Atelier AI" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/today" });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/today`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Sign in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/today" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-10 shadow-sm text-center">
        <div className="size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6">
          <Sparkles className="size-5" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Atelier AI
        </h1>
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground mt-1 uppercase">
          Digital Atelier
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
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>
        <p className="mt-6 text-[11px] text-muted-foreground">
          One-tap secure sign in via Google.
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
