import { requireUser } from './_lib/auth';
import { publishArticleToWordPress, saveArticleToDrive } from './_lib/destinations';
import { errorMessage, json, readJson } from './_lib/http';
import { adminSupabase } from './_lib/supabase';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    const body = await readJson<{ article_id: string; destination: 'drive' | 'wordpress'; site_id?: string }>(req);
    const supabase = adminSupabase();
    const { data: article, error } = await supabase.from('articles').select('*').eq('id', body.article_id).eq('user_id', user.id).single();
    if (error || !article) return json({ error: 'Texto nao encontrado.' }, 404);
    if (!article.generated_html) return json({ error: 'O texto ainda nao foi gerado.' }, 409);
    if (body.destination === 'drive') return json({ ok: true, drive: await saveArticleToDrive(article) });
    if (body.destination === 'wordpress') return json({ ok: true, wordpress: await publishArticleToWordPress(article, body.site_id, { forcePublish: true }) });
    return json({ error: 'Destino invalido.' }, 422);
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config = { path: '/api/export-article' };
