import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Prefer values injected via Expo config.extra, fallback to process.env for
// local development (dotenv).
export const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Don't throw — allow app to start but warn developer.
  // eslint-disable-next-line no-console
  console.warn('[supabase] supabase url or anon key is missing. Check your .env or app.config.js');
}

export const supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});