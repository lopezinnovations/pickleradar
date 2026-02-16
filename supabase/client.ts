import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import type { Database } from './types';

// Get Supabase credentials from Expo config or fallback
const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ??
  "https://biczbxmaisdxpcbplddr.supabase.co";

const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  "YOUR_ANON_PUBLIC_KEY"; // replace with anon public key if needed

// Create ONE singleton client
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,

      // Helps prevent lock / abort errors
      lockAcquireTimeout: 5000,
    },
    global: {
      headers: {
        "X-Client-Info": "pickleradar-mobile",
      },
    },
  }
);

// Helper to verify configuration
export const isSupabaseConfigured = () => {
  const configured =
    !!SUPABASE_URL &&
    !!SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

  if (!configured) {
    console.warn("Supabase is not properly configured");
  }

  return configured;
};
