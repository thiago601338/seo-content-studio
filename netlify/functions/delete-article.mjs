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
      .maybeSingle()
    if (readError) throw readError

    // Se já foi apagado em outra aba, tratamos como sucesso.
    if (!article) return json({ ok: true, alreadyDeleted: true })

    // O texto é a fonte principal; uma eventual falha de Storage não deve
    // impedir que o usuário consiga removê-lo da biblioteca.
    const { error: deleteError } = await supabase.from('articles').delete().eq('id', id)
    if (deleteError) throw deleteError

    if (article.cover_image_path) {
      const { error: storageError } = await supabase.storage
        .from('article-images')
        .remove([article.cover_image_path])
      if (storageError) console.error('Texto apagado, mas a capa não pôde ser removida:', storageError)
    }

    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/delete-article' }
