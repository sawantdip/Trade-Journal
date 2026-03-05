import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const validUrl = isValidHttpUrl(SUPABASE_URL);

export const dbEnabled = Boolean(validUrl && SUPABASE_ANON_KEY);

export const supabase = dbEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

if (!validUrl && SUPABASE_URL) {
  console.warn("Invalid VITE_SUPABASE_URL. Falling back to local storage mode.");
}

export const ACCOUNTS_TABLE = "accounts";
export const PROFILES_TABLE = "profiles";
export const TRADES_TABLE = "trades";
