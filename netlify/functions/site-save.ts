import type { Config } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { decryptSecret, encryptSecret } from './_lib/crypto';
import { errorMessage, json, readJson } from './_lib/http';
import { adminSupabase } from './_lib/supabase';
import { getSiteMetadata } from './_lib/wordpress';

type Body = {
  id?: string;
  name: string;
  base_url: string;
  wp_username: string;
  app_password?: string;
  default_category_id?: number | null;
  default_author_id?: number | null;
};

function normalizeUrl(raw: string) {
  const url = new URL(raw.trim());
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('URL do WordPress invalida.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Use HTTPS no site WordPress.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    const body = await readJson<Body>(req);
    const supabase = adminSupabase();
    const baseUrl = normalizeUrl(body.base_url);
    const name = String(body.name || '').trim();
    const username = String(body.wp_username || '').trim();
    if (!name || !username) return json({ error: 'Nome e usuario do WordPress sao obrigatorios.' }, 422);

    let siteId = body.id || '';
    let appPassword = String(body.app_password || '').replace(/\s+/g, '').trim();

    if (siteId) {
      const { data: existing, error } = await supabase.from('sites').select('*').eq('id', siteId).eq('user_id', user.id).single();
      if (error || !existing) return json({ error: 'Site nao encontrado.' }, 404);
      if (!appPassword) {
        const { data: secret, error: secretError } = await supabase.from('site_secrets').select('encrypted_app_password').eq('site_id', siteId).single();
        if (secretError || !secret) throw new Error('Credencial do WordPress nao encontrada. Informe novamente a senha de aplicativo.');
        appPassword = decryptSecret(secret.encrypted_app_password);
      }
    } else if (!appPassword) {
      return json({ error: 'A senha de aplicativo do WordPress e obrigatoria no primeiro cadastro.' }, 422);
    }

    const metadata = await getSiteMetadata({ base_url: baseUrl, wp_username: username, app_password: appPassword });

    if (siteId) {
      const { error } = await supabase.from('sites').update({
        name,
        base_url: baseUrl,
        wp_username: username,
        default_category_id: body.default_category_id || null,
        default_author_id: body.default_author_id || null,
        metadata,
        active: true,
      }).eq('id', siteId).eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('sites').insert({
        user_id: user.id,
        name,
        base_url: baseUrl,
        wp_username: username,
        default_category_id: body.default_category_id || null,
        default_author_id: body.default_author_id || null,
        metadata,
      }).select('*').single();
      if (error || !data) throw error || new Error('Falha ao cadastrar site.');
      siteId = data.id;
    }

    if (body.app_password || !body.id) {
      const { error } = await supabase.from('site_secrets').upsert({
        site_id: siteId,
        encrypted_app_password: encryptSecret(appPassword),
      });
      if (error) throw error;
    }

    const { data: site, error: readError } = await supabase.from('sites').select('*').eq('id', siteId).eq('user_id', user.id).single();
    if (readError) throw readError;
    return json({ site });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config: Config = { path: '/api/site-save' };
