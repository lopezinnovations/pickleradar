import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import type { Database } from './types';

// Get Supabase credentials from Expo config or fallback
const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ??
  'https://biczbxmaisdxpcbplddr.supabase.co';

const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  'YOUR_ANON_PUBLIC_KEY';

// --- Storage: AsyncStorage (native) vs localStorage (web) ---
const isWeb = Platform.OS === 'web';

// Only require AsyncStorage on native to avoid web weirdness
const nativeAsyncStorage = !isWeb
  ? // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@react-native-async-storage/async-storage').default
  : null;

// Supabase expects an async storage interface (getItem/setItem/removeItem returning Promises)
const webStorage = {
  getItem: (key: string) => Promise.resolve(globalThis?.localStorage?.getItem(key) ?? null),
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

// --- HMR-safe singleton (prevents multiple auth clients + lock contention on web) ---
declare global {
  // eslint-disable-next-line no-var
  var __pickleradar_supabase__: ReturnType<typeof createClient<Database>> | undefined;
}

export const supabase =
  globalThis.__pickleradar_supabase__ ??
  createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,

      // Web should generally allow session parsing if you ever use magic links/OAuth
      detectSessionInUrl: isWeb,

      // Helps avoid “lock acquire” hangs; bump slightly for slower browsers/dev
      lockAcquireTimeout: 15000,
    },
    global: {
      headers: {
        'X-Client-Info': `pickleradar-${isWeb ? 'web' : 'native'}`,
      },
    },
  });

if (!globalThis.__pickleradar_supabase__) {
  globalThis.__pickleradar_supabase__ = supabase;
}

// Helper to verify configuration
export const isSupabaseConfigured = () => {
  const configured =
    !!SUPABASE_URL &&
    !!SUPABASE_ANON_KEY &&
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

  if (!configured) {
    console.warn('Supabase is not properly configured');
  }
  return configured;
};
