import { createClient } from '@supabase/supabase-js';

// Environment variables with empty strings as fallbacks to prevent runtime crashes during initial run.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Graceful Supabase Client initialization
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Debug log for developer environment setup
if (!isSupabaseConfigured) {
  console.warn(
    'MORS Warning: Supabase credentials are missing from your environment variables. ' +
    'The application will run in Local-Only/Offline Mode using IndexedDB.'
  );
}
