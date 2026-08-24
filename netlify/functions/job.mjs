import { assertAuthorized, handleError, json } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

export default async (req) => {
  try {
    assertAuthorized(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) {
      const error = new Error('ID do job não informado.')
      error.status = 400
      throw error
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('article_jobs').select('*').eq('id', id).single()
    if (error) throw error
    return json({ job: data })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/job' }
