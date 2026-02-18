// app/integrations/supabase/client.ts
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

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

let _webEnvLogDone = false;

function getExtra() {
  // expo-constants shape varies between environments; this handles both.
  return (Constants.expoConfig?.extra ?? (Constants as any).manifest?.extra ?? {}) as any;
}

function getSupabaseEnv() {
  // Prefer runtime env vars
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const envAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (envUrl && envAnon) {
    const out = { url: envUrl, anon: envAnon, source: "env" as const };
    if (isWeb && !_webEnvLogDone) {
      _webEnvLogDone = true;
      const anonPreview = envAnon ? `${envAnon.slice(0, 8)}…` : "(empty)";
      console.log(
        "[Supabase] env source=env urlPresent=true anonPresent=true anonPreview=" + anonPreview
      );
    }
    return out;
  }

  // Fallback to app config extras (useful on web/dev when env injection is flaky)
  const extra = getExtra();
  const extraUrl = (extra?.supabaseUrl ?? extra?.SUPABASE_URL ?? "") as string;
  const extraAnon = (extra?.supabaseAnonKey ?? extra?.SUPABASE_ANON_KEY ?? "") as string;

  const out = {
    url: extraUrl ?? "",
    anon: extraAnon ?? "",
    source: "extra" as const,
  };
  if (isWeb && !_webEnvLogDone) {
    _webEnvLogDone = true;
    const urlPresent = !!out.url;
    const anonPresent = !!out.anon;
    const anonPreview = out.anon ? `${out.anon.slice(0, 8)}…` : "(empty)";
    console.log(
      `[Supabase] env source=extra urlPresent=${urlPresent} anonPresent=${anonPresent} anonPreview=${anonPreview}`
    );
  }
  return out;
}

export const isSupabaseConfigured = () => {
  const { url, anon, source } = getSupabaseEnv();
  const ok = !!url && !!anon;

  if (!ok) {
    console.warn(
      `[Supabase] Missing config (source=${source}). ` +
        "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env for local web/dev, " +
        "and in eas.json env (or EAS env vars) for builds."
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
  if (globalThis.__pickleradar_supabase__) return globalThis.__pickleradar_supabase__ as any;

  const { url, anon } = getSupabaseEnv();

  // ✅ If not configured, don't create a client (prevents crash)
  if (!url || !anon) return null as any;

  const client = createClient(url, anon, {
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
