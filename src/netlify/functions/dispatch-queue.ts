import { adminSupabase } from './_lib/supabase';

export default async () => {
  const supabase = adminSupabase();
  const now = new Date().toISOString();
  const { data: rows } = await supabase.from('articles')
    .select('id')
    .eq('status', 'queued')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(3);

  if (!rows?.length) return new Response(null, { status: 204 });
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.APP_URL;
  const secret = process.env.INTERNAL_DISPATCH_SECRET || '';
  if (!base || !secret) return new Response('Configuracao de dispatcher ausente.', { status: 500 });

  await Promise.all(rows.map((row) => fetch(`${base.replace(/\/$/, '')}/api/process-article`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-dispatch-secret': secret,
    },
    body: JSON.stringify({ article_id: row.id }),
  }).catch(() => null)));

  return new Response(null, { status: 204 });
};
