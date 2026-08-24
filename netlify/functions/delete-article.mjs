import { assertAuthorized, handleError, json, parseJson, requireMethod } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

export default async (req) => {
  try {
    requireMethod(req, 'POST')
    assertAuthorized(req)
    const { id } = await parseJson(req)
    if (!id) {
      const error = new Error('ID do artigo não informado.')
      error.status = 400
      throw error
    }

    const supabase = getSupabaseAdmin()
    const { data: article, error: readError } = await supabase
      .from('articles')
      .select('id,cover_image_path')
      .eq('id', id)
      .single()
    if (readError) throw readError

    if (article.cover_image_path) {
      await supabase.storage.from('article-images').remove([article.cover_image_path])
    }

    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (error) throw error
    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/delete-article' }
