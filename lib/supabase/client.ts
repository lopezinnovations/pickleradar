
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase credentials from environment or constants
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || "https://biczbxmaisdxpcbplddr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || "sb_publishable_G_5RZYmomd6zB_uFbRCDtw_rBflTxYk";

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured = () => {
  const configured = SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== '' && 
                     SUPABASE_URL !== 'YOUR_SUPABASE_URL' && 
                     SUPABASE_PUBLISHABLE_KEY !== 'YOUR_SUPABASE_ANON_KEY';
  
  if (!configured) {
    console.log('Supabase is not properly configured');
  }
  
  return configured;
};
