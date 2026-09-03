import { createClient } from '@supabase/supabase-js';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ${name} nao configurada no Netlify.`);
  return value;
}

export function adminSupabase() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SECRET_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
