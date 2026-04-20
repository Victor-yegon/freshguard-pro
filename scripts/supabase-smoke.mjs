import fs from "node:fs";
import path from "node:path";

function parseDotenv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

const cwd = process.cwd();
const envLocalPath = path.join(cwd, ".env.local");
const envPath = path.join(cwd, ".env");

const envLocal = readEnvFile(envLocalPath);
const envFile = readEnvFile(envPath);
const merged = {
  ...(envFile ? parseDotenv(envFile) : {}),
  ...(envLocal ? parseDotenv(envLocal) : {}),
};

const url = merged.VITE_SUPABASE_URL;
const anonKey = merged.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Create .env.local from .env.example and retry.",
  );
  process.exit(2);
}

if (url.includes("YOUR_PROJECT_ID") || anonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
  console.error("Env values are still placeholders. Paste your real Supabase URL and anon key.");
  process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(url, anonKey);

function formatError(prefix, error) {
  const parts = [
    `${prefix}: ${error?.message ?? "Unknown error"}`,
    error?.status ? `status=${error.status}` : null,
    error?.code ? `code=${error.code}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

// Basic connectivity/auth sanity
const sessionResult = await supabase.auth.getSession();
if (sessionResult.error) {
  console.error(formatError("Auth getSession failed", sessionResult.error));
  process.exit(1);
}

// DB smoke query (may fail if RLS blocks anon/unauthenticated access)
const usersResult = await supabase.from("users").select("*", { count: "exact", head: true });

if (usersResult.error) {
  console.error(formatError("DB query failed (users)", usersResult.error));
  console.error(
    "If this is 401/403, connectivity is OK but RLS requires you to sign in (use the in-app magic link).",
  );
  process.exit(1);
}

const roomsResult = await supabase
  .from("storage_rooms")
  .select("*", { count: "exact", head: true });

if (roomsResult.error) {
  console.error(formatError("DB query failed (storage_rooms)", roomsResult.error));
  process.exit(1);
}

console.log(
  "OK: Supabase connected. users count =",
  usersResult.count ?? "unknown",
  ", storage_rooms count =",
  roomsResult.count ?? "unknown",
);
