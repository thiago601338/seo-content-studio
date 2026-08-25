import { assertAuthorized, handleError, json, parseJson, requireMethod } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

export default async (req) => {
  try {
    requireMethod(req, 'POST')
    assertAuthorized(req)
    const body = await parseJson(req)

    const quantity = Number(body.quantity)
    const keyword = String(body.keyword || '').trim()
    const linkUrl = String(body.linkUrl || '').trim()
    const createCover = Boolean(body.createCover)
    const keywordInTitle = Boolean(body.keywordInTitle)
    const instructions = String(body.instructions || '').trim()

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 120) {
      const error = new Error('A quantidade deve ser de 1 a 120 textos por lote.')
      error.status = 400
      throw error
    }
    if (keyword.length < 2 || keyword.length > 160) {
      const error = new Error('Informe uma palavra-chave válida.')
      error.status = 400
      throw error
    }
    if (instructions.length > 6000) {
      const error = new Error('O direcionamento pode ter no máximo 6000 caracteres.')
      error.status = 400
      throw error
    }
    let url
    try { url = new URL(linkUrl) } catch { url = null }
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      const error = new Error('Informe um link válido começando com http:// ou https://')
      error.status = 400
      throw error
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('article_jobs')
      .insert({
        quantity,
        keyword,
        link_url: url.toString(),
        create_cover: createCover,
        keyword_in_title: keywordInTitle,
        instructions: instructions || null,
        status: 'queued',
      })
      .select('*')
      .single()

    if (error) throw error
    return json({ job: data }, 201)
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/start-job' }
