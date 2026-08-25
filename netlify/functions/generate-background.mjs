import { randomUUID } from 'node:crypto'
import { assertAuthorized, parseJson } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'
import { countWords, generateCoverImage, generateSeoArticle, slugify, stripHtml } from './_lib/seo.mjs'

const TERMINAL_STATUSES = new Set(['completed', 'completed_with_errors', 'failed'])

async function continueJob(req, jobId, runVersion) {
  const origin = new URL(req.url).origin
  const response = await fetch(`${origin}/api/generate-background`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-app-password': process.env.APP_PASSWORD || '',
    },
    body: JSON.stringify({ jobId, runVersion }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Não foi possível continuar o lote automaticamente (${response.status}): ${detail}`)
  }
}

async function shouldStop(supabase, jobId, runVersion) {
  const { data, error } = await supabase
    .from('article_jobs')
    .select('status,pause_requested,run_version')
    .eq('id', jobId)
    .single()
  if (error) throw error

  // Um pause/resume incrementa run_version. Workers antigos passam a ser
  // inválidos imediatamente, mesmo que ainda estejam aguardando a OpenAI.
  if (Number(data.run_version || 0) !== runVersion) return true
  if (TERMINAL_STATUSES.has(data.status) || data.status === 'paused') return true

  // Compatibilidade com a versão anterior, que usava pause_requested.
  if (data.pause_requested) {
    const { error: pauseError } = await supabase
      .from('article_jobs')
      .update({
        status: 'paused',
        pause_requested: false,
        paused_at: new Date().toISOString(),
        run_version: runVersion + 1,
      })
      .eq('id', jobId)
      .eq('run_version', runVersion)
    if (pauseError) throw pauseError
    return true
  }

  return data.status !== 'processing'
}

async function removeUploadedCover(supabase, path) {
  if (!path) return
  const { error } = await supabase.storage.from('article-images').remove([path])
  if (error) console.error('Não foi possível limpar a capa de uma execução invalidada:', error)
}

export default async (req) => {
  let jobId = null
  let runVersion = null
  const supabase = getSupabaseAdmin()

  try {
    assertAuthorized(req)
    const body = await parseJson(req)
    jobId = body.jobId
    if (!jobId) throw new Error('jobId não informado.')

    const { data: initialJob, error: jobError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    if (jobError) throw jobError

    const requestedRunVersion = body.runVersion === undefined || body.runVersion === null
      ? Number(initialJob.run_version || 0)
      : Number(body.runVersion)

    if (!Number.isInteger(requestedRunVersion) || requestedRunVersion < 0) {
      throw new Error('runVersion inválida.')
    }
    runVersion = requestedRunVersion

    if (Number(initialJob.run_version || 0) !== runVersion) return
    if (TERMINAL_STATUSES.has(initialJob.status) || initialJob.status === 'paused') return
    if (!['queued', 'processing'].includes(initialJob.status)) return

    let job = initialJob

    if (job.status === 'queued') {
      const { data: claimed, error: claimError } = await supabase
        .from('article_jobs')
        .update({
          status: 'processing',
          started_at: job.started_at || new Date().toISOString(),
          paused_at: null,
          pause_requested: false,
        })
        .eq('id', jobId)
        .eq('status', 'queued')
        .eq('run_version', runVersion)
        .select('*')
        .maybeSingle()
      if (claimError) throw claimError
      if (!claimed) return
      job = claimed
    }

    if (await shouldStop(supabase, jobId, runVersion)) return

    // Divide lotes grandes em blocos menores para a função não ficar presa por
    // tempo demais. Cada continuação carrega a mesma run_version.
    const chunkSize = job.create_cover ? 3 : 6
    let completed = Number(job.completed_count || 0)
    let failed = Number(job.failed_count || 0)
    const alreadyProcessed = completed + failed
    const startIndex = alreadyProcessed + 1
    const endIndex = Math.min(job.quantity, alreadyProcessed + chunkSize)

    const { data: existingArticles, error: titlesError } = await supabase
      .from('articles')
      .select('title')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(12)
    if (titlesError) throw titlesError

    const titles = (existingArticles || []).map((item) => item.title).filter(Boolean)
    const errors = job.error_message ? job.error_message.split('\n').filter(Boolean).slice(-5) : []

    for (let index = startIndex; index <= endIndex; index += 1) {
      if (await shouldStop(supabase, jobId, runVersion)) return

      let coverImagePath = null
      try {
        const article = await generateSeoArticle({
          keyword: job.keyword,
          linkUrl: job.link_url,
          keywordInTitle: job.keyword_in_title,
          index,
          quantity: job.quantity,
          previousTitles: titles.slice(-12),
          instructions: job.instructions || '',
        })

        // A pausa pode ter sido solicitada enquanto a OpenAI escrevia o texto.
        // Nesse caso descartamos o retorno antes de gravar qualquer coisa.
        if (await shouldStop(supabase, jobId, runVersion)) return

        titles.push(article.title)
        let coverImageUrl = null

        if (job.create_cover) {
          try {
            const imageBuffer = await generateCoverImage(article.cover_prompt)
            if (await shouldStop(supabase, jobId, runVersion)) return

            coverImagePath = `${job.id}/${randomUUID()}.webp`
            const { error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(coverImagePath, imageBuffer, {
                contentType: 'image/webp',
                upsert: false,
              })
            if (uploadError) throw uploadError

            if (await shouldStop(supabase, jobId, runVersion)) {
              await removeUploadedCover(supabase, coverImagePath)
              return
            }

            const { data: publicData } = supabase.storage.from('article-images').getPublicUrl(coverImagePath)
            coverImageUrl = publicData.publicUrl
          } catch (imageError) {
            console.error('Falha ao gerar capa:', imageError)
            errors.push(`Artigo ${index}: texto criado, mas a capa falhou (${imageError.message}).`)
            coverImagePath = null
          }
        }

        if (await shouldStop(supabase, jobId, runVersion)) {
          await removeUploadedCover(supabase, coverImagePath)
          return
        }

        const plainText = stripHtml(article.html_content)
        const { error: insertError } = await supabase.from('articles').insert({
          job_id: job.id,
          title: article.title,
          slug: slugify(article.title),
          keyword: job.keyword,
          link_url: job.link_url,
          meta_description: article.meta_description,
          excerpt: article.excerpt,
          html_content: article.html_content,
          plain_text: plainText,
          cover_image_url: coverImageUrl,
          cover_image_path: coverImagePath,
          word_count: countWords(plainText),
        })
        if (insertError) throw insertError

        completed += 1
      } catch (articleError) {
        // Se a execução foi invalidada por uma pausa, não conte como falha.
        if (await shouldStop(supabase, jobId, runVersion)) {
          await removeUploadedCover(supabase, coverImagePath)
          return
        }
        console.error(`Falha no artigo ${index}:`, articleError)
        failed += 1
        errors.push(`Artigo ${index}: ${articleError.message}`)
      }

      const { data: progressRow, error: progressError } = await supabase
        .from('article_jobs')
        .update({
          completed_count: completed,
          failed_count: failed,
          error_message: errors.length ? errors.slice(-5).join('\n') : null,
        })
        .eq('id', jobId)
        .eq('status', 'processing')
        .eq('run_version', runVersion)
        .select('id')
        .maybeSingle()
      if (progressError) throw progressError
      if (!progressRow) return

      if (await shouldStop(supabase, jobId, runVersion)) return
    }

    const processed = completed + failed
    if (processed < job.quantity) {
      if (await shouldStop(supabase, jobId, runVersion)) return
      await continueJob(req, jobId, runVersion)
      return
    }

    const status = completed === 0 ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed'
    await supabase
      .from('article_jobs')
      .update({
        status,
        pause_requested: false,
        paused_at: null,
        completed_count: completed,
        failed_count: failed,
        completed_at: new Date().toISOString(),
        error_message: errors.length ? errors.slice(-5).join('\n') : null,
      })
      .eq('id', jobId)
      .eq('status', 'processing')
      .eq('run_version', runVersion)
  } catch (error) {
    console.error('Background generation failed:', error)
    if (jobId) {
      try {
        const { data: current } = await supabase
          .from('article_jobs')
          .select('status,run_version')
          .eq('id', jobId)
          .maybeSingle()

        const sameRun = current && (runVersion === null || Number(current.run_version || 0) === runVersion)
        if (sameRun && current.status !== 'paused' && !TERMINAL_STATUSES.has(current.status)) {
          await supabase
            .from('article_jobs')
            .update({
              status: 'failed',
              pause_requested: false,
              completed_at: new Date().toISOString(),
              error_message: error.message,
            })
            .eq('id', jobId)
            .eq('run_version', Number(current.run_version || 0))
        }
      } catch (updateError) {
        console.error('Não foi possível registrar a falha do job:', updateError)
      }
    }
  }
}

export const config = {
  path: '/api/generate-background',
  background: true,
}
