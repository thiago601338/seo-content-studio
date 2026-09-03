import type { Config } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { errorMessage, json, readJson } from './_lib/http';
import { adminSupabase } from './_lib/supabase';

type DeleteBody = { article_id?: string; all_generated?: boolean };

async function removeMedia(supabase: ReturnType<typeof adminSupabase>, rows: any[]) {
  const paths = rows.flatMap((row) => Array.isArray(row.generated_media) ? row.generated_media.map((m: any) => m?.path).filter(Boolean) : []);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from('article-media').remove(paths.slice(i, i + 100));
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    const body = await readJson<DeleteBody>(req);
    const supabase = adminSupabase();

    if (body.article_id) {
      const { data: row, error } = await supabase.from('articles')
        .select('id, generated_media')
        .eq('id', body.article_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!row) return json({ ok: true, deleted: 0 });
      await removeMedia(supabase, [row]);
      const { error: deleteError } = await supabase.from('articles').delete().eq('id', row.id).eq('user_id', user.id);
      if (deleteError) throw deleteError;
      return json({ ok: true, deleted: 1 });
    }

    if (body.all_generated) {
      let deleted = 0;
      while (true) {
        const { data: rows, error } = await supabase.from('articles')
          .select('id, generated_media')
          .eq('user_id', user.id)
          .not('generated_html', 'is', null)
          .limit(200);
        if (error) throw error;
        if (!rows?.length) break;
        await removeMedia(supabase, rows);
        const ids = rows.map((row) => row.id);
        const { error: deleteError } = await supabase.from('articles').delete().eq('user_id', user.id).in('id', ids);
        if (deleteError) throw deleteError;
        deleted += ids.length;
        if (rows.length < 200) break;
      }
      return json({ ok: true, deleted });
    }

    return json({ error: 'Informe article_id ou all_generated.' }, 422);
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config: Config = { path: '/api/delete-articles' };
