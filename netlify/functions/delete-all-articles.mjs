import { assertAuthorized, handleError, json, requireMethod } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

const PAGE_SIZE = 400
const STORAGE_CHUNK = 100

export default async (req) => {
  try {
    requireMethod(req, 'POST')
    assertAuthorized(req)
    const supabase = getSupabaseAdmin()

    // Congela o conjunto a ser apagado no instante do clique. Assim a ação
    // termina mesmo se algum job ativo criar novos artigos depois.
    const cutoff = new Date().toISOString()
    let deleted = 0
    let storageWarnings = 0

    while (true) {
      const { data: articles, error: readError } = await supabase
        .from('articles')
        .select('id,cover_image_path')
        .lte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE)

      if (readError) throw readError
      if (!articles?.length) break

      const paths = articles.map((item) => item.cover_image_path).filter(Boolean)
      for (let i = 0; i < paths.length; i += STORAGE_CHUNK) {
        const { error: storageError } = await supabase.storage
          .from('article-images')
          .remove(paths.slice(i, i + STORAGE_CHUNK))
        if (storageError) {
          storageWarnings += 1
          console.error('Falha ao remover algumas capas durante exclusão em massa:', storageError)
        }
      }

      const ids = articles.map((item) => item.id)
      const { error: deleteError } = await supabase.from('articles').delete().in('id', ids)
      if (deleteError) throw deleteError
      deleted += ids.length
    }

    return json({ ok: true, deleted, cutoff, storageWarnings })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/delete-all-articles' }
