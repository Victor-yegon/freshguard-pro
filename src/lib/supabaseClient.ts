import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseBrowserClient: SupabaseClient | null = null;

function getRequiredEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") {
  let value = (import.meta.env[name] ?? "").trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local (see .env.example) and restart the dev server.`,
    );
  }

  // Defensive: in case quotes were accidentally included in the value itself.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  if (name === "VITE_SUPABASE_URL") {
    let parsed: URL | null = null;
    try {
      parsed = new URL(value);
    } catch {
      parsed = null;
    }

    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      throw new Error(
        `Invalid VITE_SUPABASE_URL: Must be a valid HTTP or HTTPS URL (example: https://YOUR_PROJECT_REF.supabase.co).`,
      );
    }
  }

  return value;
}

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("Supabase browser client is only available in the browser.");
  }

  if (!supabaseBrowserClient) {
    supabaseBrowserClient = createClient(
      getRequiredEnv("VITE_SUPABASE_URL"),
      getRequiredEnv("VITE_SUPABASE_ANON_KEY"),
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return supabaseBrowserClient;
}
