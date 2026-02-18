// app/integrations/supabase/client.ts
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Prefer EXPO_PUBLIC_* env vars (works in Expo reliably)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const isWeb = Platform.OS === "web";

// Minimal async interface for web storage
const webStorage = {
  getItem: (key: string) =>
    Promise.resolve(globalThis?.localStorage?.getItem(key) ?? null),
  setItem: (key: string, value: string) => {
    globalThis?.localStorage?.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    globalThis?.localStorage?.removeItem(key);
    return Promise.resolve();
  },
};

const storage = isWeb ? webStorage : AsyncStorage;

export const isSupabaseConfigured = () => {
  const ok = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
  if (!ok) {
    console.warn(
      "[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add them to .env (recommended) or app config. Supabase features disabled."
    );
  }
  return ok;
};

// --- HMR-safe singleton (prevents multiple clients) ---
declare global {
  // eslint-disable-next-line no-var
  var __pickleradar_supabase__: ReturnType<typeof createClient> | undefined;
}

export const supabase = (() => {
  // ✅ If not configured, don't create a client (prevents crash)
  if (!isSupabaseConfigured()) return null as any;

  const existing = globalThis.__pickleradar_supabase__;
  if (existing) return existing;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb,
      lockAcquireTimeout: 15000,
    },
  });

  globalThis.__pickleradar_supabase__ = client;
  return client;
})();
