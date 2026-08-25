import { assertAuthorized, handleError, json } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

export default async (req) => {
  try {
    assertAuthorized(req)
    const search = (new URL(req.url).searchParams.get('search') || '').trim()
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('articles')
      .select('id,title,keyword,meta_description,cover_image_url,word_count,created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (search) {
      const safe = search.replace(/[%_,()]/g, ' ')
      query = query.or(`title.ilike.%${safe}%,keyword.ilike.%${safe}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return json({ articles: data || [] })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/articles' }
