import { assertAuthorized, handleError, json } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

const ACTIVE_STATUSES = ['queued', 'processing', 'paused']

export default async (req) => {
  try {
    assertAuthorized(req)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('article_jobs')
      .select('*')
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: true })
      .limit(250)

    if (error) throw error
    return json({ jobs: data || [] })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/jobs' }
