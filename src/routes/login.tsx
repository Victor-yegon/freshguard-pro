import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { AuthLayout } from "@/components/layouts/AuthLayout";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — FoodSafe Monitor" },
      { name: "description", content: "Sign in to FoodSafe Monitor." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  function getClient() {
    try {
      return getSupabaseBrowserClient();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize Supabase");
      return null;
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("Signing in…");

    const supabase = getClient();
    if (!supabase) return;

    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setStatus("");
      setError(result.error.message);
      return;
    }

    const authUser = result.data.user;
    if (!authUser) {
      setStatus("");
      setError("Login succeeded but no user profile was returned.");
      return;
    }

    const fullNameFromMeta =
      typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : "";
    const fallbackName = authUser.email?.split("@")[0] ?? "User";

    const profileSync = await supabase.from("users").upsert(
      {
        id: authUser.id,
        full_name: fullNameFromMeta || fallbackName,
        email: authUser.email ?? email,
        password_hash: "managed_by_supabase_auth",
      },
      { onConflict: "id" },
    );

    if (profileSync.error) {
      setStatus("");
      if (profileSync.error.message.toLowerCase().includes("row-level security")) {
        setError(
          "Signed in, but profile sync was blocked by database RLS policy. Please apply the users table RLS policy from database/database.sql.",
        );
        return;
      }

      setError(`Signed in, but profile sync failed: ${profileSync.error.message}`);
      return;
    }

    setStatus("Signed in.");
    await navigate({ to: "/dashboard" });
  }

  async function sendMagicLink() {
    setError(null);
    setStatus("Sending magic link…");

    const supabase = getClient();
    if (!supabase) return;

    const result = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (result.error) {
      setStatus("");
      setError(result.error.message);
      return;
    }

    setStatus("Magic link sent. Check your email.");
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with email and password, or request a magic link."
    >
      <form
        onSubmit={signInWithPassword}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-foreground">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

        {status ? <p className="text-sm text-muted-foreground">{status}</p> : <div className="h-5" />}

        <div className="flex flex-col gap-2">
          <Button type="submit" className="rounded-xl">
            Sign in
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={sendMagicLink}
            disabled={!email}
          >
            Send magic link
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Don’t have an account?{" "}
          <Link to="/register" className="text-foreground underline underline-offset-4">
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
