import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register - ChillSense" },
      { name: "description", content: "Create your ChillSense account." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = React.useState("");
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

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("Creating account...");

    const supabase = getClient();
    if (!supabase) return;

    const authResult = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });

    if (authResult.error) {
      setStatus("");
      setError(authResult.error.message);
      return;
    }

    const userId = authResult.data.user?.id;
    const hasSession = !!authResult.data.session;

    if (!userId || !hasSession) {
      setStatus("Account created. Please confirm your email, then login.");
      await navigate({ to: "/login" });
      return;
    }

    // Keep public.users in sync with auth.users for your custom schema.
    const upsertResult = await supabase.from("users").upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        password_hash: "managed_by_supabase_auth",
      },
      { onConflict: "id" },
    );

    if (upsertResult.error) {
      setStatus("");
      if (upsertResult.error.message.toLowerCase().includes("row-level security")) {
        setError(
          "Auth account created, but profile sync was blocked by database RLS policy. Please apply the users table RLS policy from database/database.sql.",
        );
        return;
      }

      setError(`Auth created, but users insert failed: ${upsertResult.error.message}`);
      return;
    }

    setStatus("Account created. If required, confirm your email then login.");
    await navigate({ to: "/login" });
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">Register</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Create your account
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Use email and password. You may need to confirm your email in Supabase.
      </p>

      <form
        onSubmit={signUp}
        className="mt-8 rounded-3xl border border-border/60 bg-card p-6 shadow-[var(--shadow-soft)]"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Full name</label>
          <Input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>

        <div className="mt-4 space-y-2">
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
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>

        {error ? (
          <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : null}

        {status ? (
          <p className="mt-4 text-sm text-muted-foreground">{status}</p>
        ) : (
          <div className="mt-4" />
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button type="submit" className="rounded-xl">
            Create account
          </Button>
          <Button asChild type="button" variant="outline" className="rounded-xl">
            <Link to="/login">Go to login</Link>
          </Button>
        </div>
      </form>
    </main>
  );
}
