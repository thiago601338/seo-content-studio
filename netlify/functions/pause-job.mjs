import { assertAuthorized, handleError, json, parseJson, requireMethod } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

const TERMINAL_STATUSES = new Set(['completed', 'completed_with_errors', 'failed'])

export default async (req) => {
  try {
    requireMethod(req, 'POST')
    assertAuthorized(req)
    const body = await parseJson(req)
    const id = String(body.id || '').trim()
    if (!id) {
      const error = new Error('ID da geração não informado.')
      error.status = 400
      throw error
    }

    const supabase = getSupabaseAdmin()
    const { data: current, error: readError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', id)
      .single()
    if (readError) throw readError

    if (TERMINAL_STATUSES.has(current.status)) {
      const error = new Error('Esta geração já foi finalizada e não pode ser pausada.')
      error.status = 409
      throw error
    }

    if (current.status === 'paused') return json({ job: current })

    // Pausa imediata: o status muda para "paused" na mesma requisição.
    // run_version invalida qualquer worker antigo que ainda esteja terminando
    // uma chamada à OpenAI, impedindo que ele grave novos textos depois da pausa.
    const nextRunVersion = Number(current.run_version || 0) + 1
    const { data, error } = await supabase
      .from('article_jobs')
      .update({
        status: 'paused',
        pause_requested: false,
        paused_at: new Date().toISOString(),
        run_version: nextRunVersion,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    return json({ job: data })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/pause-job' }
