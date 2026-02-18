import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

// Prefer EXPO_PUBLIC_* env vars (works in Expo reliably)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const isWeb = Platform.OS === "web";

// Only require AsyncStorage on native (prevents web crash)
const nativeAsyncStorage = !isWeb
  ? // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("@react-native-async-storage/async-storage").default
  : null;

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

const storage = isWeb ? webStorage : nativeAsyncStorage;

declare global {
  // eslint-disable-next-line no-var
  var __pickleradar_supabase__: ReturnType<typeof createClient> | undefined;
}

export const supabase =
  globalThis.__pickleradar_supabase__ ??
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb,
      lockAcquireTimeout: 15000,
    },
  });

if (!globalThis.__pickleradar_supabase__) {
  globalThis.__pickleradar_supabase__ = supabase;
}

export const isSupabaseConfigured = () => {
  const ok = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
  if (!ok) {
    console.warn(
      "Supabase missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return ok;
};
