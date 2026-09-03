import { supabase } from './supabase';

async function token() {
  const { data } = await supabase.auth.getSession();
  const value = data.session?.access_token;
  if (!value) throw new Error('Sessao expirada. Entre novamente.');
  return value;
}

export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      authorization: `Bearer ${await token()}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!response.ok) throw new Error(data?.error || `Erro HTTP ${response.status}`);
  return data as T;
}

export async function triggerBackground(articleId: string) {
  const response = await fetch('/api/process-article', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await token()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ article_id: articleId }),
  });
  if (![200, 202].includes(response.status)) {
    const text = await response.text();
    throw new Error(text || `Falha ao iniciar artigo (${response.status}).`);
  }
}
