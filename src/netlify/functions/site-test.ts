import type { Config } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { decryptSecret } from './_lib/crypto';
import { errorMessage, json, readJson } from './_lib/http';
import { adminSupabase } from './_lib/supabase';
import { getSiteMetadata } from './_lib/wordpress';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    const body = await readJson<{ id: string }>(req);
    const supabase = adminSupabase();
    const { data: site, error } = await supabase.from('sites').select('*').eq('id', body.id).eq('user_id', user.id).single();
    if (error || !site) return json({ error: 'Site nao encontrado.' }, 404);
    const { data: secret, error: secretError } = await supabase.from('site_secrets').select('*').eq('site_id', site.id).single();
    if (secretError || !secret) throw new Error('Credencial do WordPress ausente.');

    const metadata = await getSiteMetadata({
      base_url: site.base_url,
      wp_username: site.wp_username,
      app_password: decryptSecret(secret.encrypted_app_password),
    });
    const { error: updateError } = await supabase.from('sites').update({ metadata }).eq('id', site.id);
    if (updateError) throw updateError;
    return json({ ok: true, metadata });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config: Config = { path: '/api/site-test' };
