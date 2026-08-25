import { assertAuthorized, handleError, json, parseJson, requireMethod } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'

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

    if (current.status !== 'paused') {
      const error = new Error('Somente uma geração pausada pode ser retomada.')
      error.status = 409
      throw error
    }

    // Cada retomada recebe uma nova versão de execução. Isso evita que um
    // worker antigo (anterior à pausa) volte a gravar conteúdo por engano.
    const nextRunVersion = Number(current.run_version || 0) + 1
    const { data, error } = await supabase
      .from('article_jobs')
      .update({
        status: 'queued',
        pause_requested: false,
        paused_at: null,
        completed_at: null,
        run_version: nextRunVersion,
      })
      .eq('id', id)
      .eq('status', 'paused')
      .select('*')
      .single()
    if (error) throw error

    return json({ job: data })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/resume-job' }
