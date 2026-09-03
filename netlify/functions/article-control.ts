import type { Config } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { errorMessage, json, readJson } from './_lib/http';
import { adminSupabase } from './_lib/supabase';

type Action = 'pause' | 'resume' | 'pause_all' | 'resume_all' | 'cancel';

type ControlBody = {
  article_id?: string;
  action: Action;
};

async function triggerInternal(articleId: string) {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.APP_URL || '';
  const secret = process.env.INTERNAL_DISPATCH_SECRET || '';
  if (!base || !secret) return;
  await fetch(`${base.replace(/\/$/, '')}/api/process-article`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-dispatch-secret': secret,
    },
    body: JSON.stringify({ article_id: articleId }),
  }).catch(() => null);
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    const body = await readJson<ControlBody>(req);
    const supabase = adminSupabase();

    if (body.action === 'pause_all' || body.action === 'resume_all') {
      const statuses = body.action === 'pause_all' ? ['queued', 'processing'] : ['paused'];
      const { data: rows, error } = await supabase.from('articles')
        .select('id, run_version, status')
        .eq('user_id', user.id)
        .in('status', statuses)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;

      const nextStatus = body.action === 'pause_all' ? 'paused' : 'queued';
      const nextLabel = body.action === 'pause_all' ? 'Pausado' : 'Na fila';
      for (const row of rows || []) {
        const patch: Record<string, unknown> = {
          status: nextStatus,
          progress_label: nextLabel,
          run_version: Number(row.run_version || 0) + 1,
          paused_at: body.action === 'pause_all' ? new Date().toISOString() : null,
        };
        if (body.action === 'resume_all') patch.error = null;
        await supabase.from('articles').update(patch).eq('id', row.id).eq('user_id', user.id);
      }

      if (body.action === 'resume_all') {
        await Promise.allSettled((rows || []).slice(0, 3).map((row) => triggerInternal(row.id)));
      }
      return json({ ok: true, count: rows?.length || 0 });
    }

    if (!body.article_id) return json({ error: 'article_id obrigatorio.' }, 422);
    const { data: article, error } = await supabase.from('articles')
      .select('id, user_id, status, run_version')
      .eq('id', body.article_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!article) return json({ error: 'Artigo nao encontrado.' }, 404);

    const nextVersion = Number(article.run_version || 0) + 1;
    if (body.action === 'pause') {
      if (!['queued', 'processing'].includes(article.status)) return json({ ok: true, skipped: true, status: article.status });
      await supabase.from('articles').update({ status: 'paused', progress_label: 'Pausado', run_version: nextVersion, paused_at: new Date().toISOString() }).eq('id', article.id).eq('user_id', user.id);
      return json({ ok: true, status: 'paused' });
    }

    if (body.action === 'resume') {
      if (!['paused', 'error'].includes(article.status)) return json({ ok: true, skipped: true, status: article.status });
      await supabase.from('articles').update({ status: 'queued', progress_label: 'Na fila', run_version: nextVersion, paused_at: null, error: null }).eq('id', article.id).eq('user_id', user.id);
      await triggerInternal(article.id);
      return json({ ok: true, status: 'queued' });
    }

    if (body.action === 'cancel') {
      await supabase.from('articles').update({ status: 'cancelled', progress_label: 'Cancelado', run_version: nextVersion, paused_at: null }).eq('id', article.id).eq('user_id', user.id);
      return json({ ok: true, status: 'cancelled' });
    }

    return json({ error: 'Acao invalida.' }, 422);
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config: Config = { path: '/api/article-control' };
