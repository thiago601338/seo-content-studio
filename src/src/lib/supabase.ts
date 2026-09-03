import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  console.warn('VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY nao configurados.');
}

export const supabase = createClient(url || 'https://invalid.local', key || 'invalid', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
