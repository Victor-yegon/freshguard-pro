import * as React from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type UserRow = { id: string; full_name: string; email: string };
type RoomRow = { id: string; name: string; location: string | null };

export function SupabaseConnect() {
  const [sessionUserId, setSessionUserId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [users, setUsers] = React.useState<UserRow[] | null>(null);
  const [rooms, setRooms] = React.useState<RoomRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function getClient() {
    try {
      return getSupabaseBrowserClient();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to initialize Supabase client";
      setError(message);
      return null;
    }
  }

  React.useEffect(() => {
    const supabase = getClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSessionUserId(data.session?.user.id ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function runSmokeQueries() {
    setError(null);
    setStatus("Querying Supabase...");

    try {
      const supabase = getClient();
      if (!supabase) {
        setStatus("");
        return;
      }

      const usersResult = await supabase.from("users").select("id,full_name,email").limit(5);

      if (usersResult.error) {
        setUsers(null);
        setRooms(null);
        setStatus("");
        setError(`DB query failed. users: ${usersResult.error.message}`);
        return;
      }

      const roomsResult = await supabase.from("storage_rooms").select("id,name,location").limit(5);

      if (roomsResult.error) {
        setUsers(usersResult.data as UserRow[]);
        setRooms(null);
        setStatus("");
        setError(`storage_rooms: ${roomsResult.error.message}`);
        return;
      }

      setUsers(usersResult.data as UserRow[]);
      setRooms(roomsResult.data as RoomRow[]);
      setStatus("Connected.");
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function signInWithMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("Sending magic link...");

    try {
      const supabase = getClient();
      if (!supabase) {
        setStatus("");
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setStatus("Magic link sent. Check your email.");
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function signOut() {
    setError(null);
    setStatus("Signing out...");

    try {
      const supabase = getClient();
      if (!supabase) {
        setStatus("");
        return;
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setStatus("Signed out.");
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Supabase connection (dev)</h3>
            <p className="text-sm text-muted-foreground">
              Uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from `.env.local`.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runSmokeQueries}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Test DB
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Auth session
            </p>
            <p className="mt-2 text-sm text-foreground">
              {sessionUserId ? (
                <>
                  Signed in as <span className="font-mono">{sessionUserId}</span>
                </>
              ) : (
                "Not signed in"
              )}
            </p>

            <form onSubmit={signInWithMagicLink} className="mt-4 flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@company.com"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Magic link
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Results
            </p>
            <div className="mt-2 text-sm text-foreground">
              {status ? <p>{status}</p> : <p className="text-muted-foreground">-</p>}
              {error ? (
                <p className="mt-2 rounded-md bg-destructive/10 p-2 text-destructive">{error}</p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Users
                </p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {(users ?? []).slice(0, 5).map((u) => (
                    <li key={u.id} className="truncate">
                      {u.full_name} <span className="text-muted-foreground">({u.email})</span>
                    </li>
                  ))}
                  {!users ? (
                    <li className="text-muted-foreground">Not loaded</li>
                  ) : users.length === 0 ? (
                    <li className="text-muted-foreground">No rows</li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Storage rooms
                </p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {(rooms ?? []).slice(0, 5).map((r) => (
                    <li key={r.id} className="truncate">
                      {r.name}{" "}
                      <span className="text-muted-foreground">({r.location ?? "no location"})</span>
                    </li>
                  ))}
                  {!rooms ? (
                    <li className="text-muted-foreground">Not loaded</li>
                  ) : rooms.length === 0 ? (
                    <li className="text-muted-foreground">No rows</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
