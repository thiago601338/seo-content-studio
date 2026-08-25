import { randomUUID } from 'node:crypto'
import { assertAuthorized, parseJson } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'
import { countWords, generateCoverImage, generateSeoArticle, slugify, stripHtml } from './_lib/seo.mjs'

const TERMINAL_STATUSES = new Set(['completed', 'completed_with_errors', 'failed'])

async function continueJob(req, jobId) {
  const origin = new URL(req.url).origin
  const response = await fetch(`${origin}/api/generate-background`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-app-password': process.env.APP_PASSWORD || '',
    },
    body: JSON.stringify({ jobId }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Não foi possível continuar o lote automaticamente (${response.status}): ${detail}`)
  }
}

async function shouldStopForPause(supabase, jobId) {
  const { data, error } = await supabase
    .from('article_jobs')
    .select('status,pause_requested')
    .eq('id', jobId)
    .single()
  if (error) throw error

  if (TERMINAL_STATUSES.has(data.status) || data.status === 'paused') return true

  if (data.pause_requested) {
    const { error: pauseError } = await supabase
      .from('article_jobs')
      .update({
        status: 'paused',
        pause_requested: false,
        paused_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('pause_requested', true)
    if (pauseError) throw pauseError
    return true
  }

  return false
}

export default async (req) => {
  let jobId = null
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

    if (TERMINAL_STATUSES.has(initialJob.status) || initialJob.status === 'paused') return
    if (!['queued', 'processing'].includes(initialJob.status)) return

    let job = initialJob

    if (job.status === 'queued') {
      // Atualização condicional: se o usuário pausar enquanto a função está iniciando,
      // o status "paused" não será sobrescrito por "processing".
      const { data: claimed, error: claimError } = await supabase
        .from('article_jobs')
        .update({
          status: 'processing',
          started_at: job.started_at || new Date().toISOString(),
          paused_at: null,
        })
        .eq('id', jobId)
        .eq('status', 'queued')
        .eq('pause_requested', false)
        .select('*')
        .maybeSingle()
      if (claimError) throw claimError
      if (!claimed) return
      job = claimed
    }

    if (await shouldStopForPause(supabase, jobId)) return

    // Um lote de até 120 textos é dividido em blocos menores. A pausa é
    // cooperativa: se for solicitada durante a criação de um artigo, o artigo
    // atual pode terminar, mas nenhum novo artigo será iniciado depois disso.
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
      if (await shouldStopForPause(supabase, jobId)) return

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

        titles.push(article.title)
        let coverImageUrl = null
        let coverImagePath = null

        if (job.create_cover) {
          try {
            const imageBuffer = await generateCoverImage(article.cover_prompt)
            coverImagePath = `${job.id}/${randomUUID()}.webp`
            const { error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(coverImagePath, imageBuffer, {
                contentType: 'image/webp',
                upsert: false,
              })
            if (uploadError) throw uploadError
            const { data: publicData } = supabase.storage.from('article-images').getPublicUrl(coverImagePath)
            coverImageUrl = publicData.publicUrl
          } catch (imageError) {
            console.error('Falha ao gerar capa:', imageError)
            errors.push(`Artigo ${index}: texto criado, mas a capa falhou (${imageError.message}).`)
          }
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
        console.error(`Falha no artigo ${index}:`, articleError)
        failed += 1
        errors.push(`Artigo ${index}: ${articleError.message}`)
      }

      const { error: progressError } = await supabase
        .from('article_jobs')
        .update({
          completed_count: completed,
          failed_count: failed,
          error_message: errors.length ? errors.slice(-5).join('\n') : null,
        })
        .eq('id', jobId)
      if (progressError) throw progressError

      if (await shouldStopForPause(supabase, jobId)) return
    }

    const processed = completed + failed
    if (processed < job.quantity) {
      if (await shouldStopForPause(supabase, jobId)) return
      await continueJob(req, jobId)
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
  } catch (error) {
    console.error('Background generation failed:', error)
    if (jobId) {
      try {
        const { data: current } = await supabase
          .from('article_jobs')
          .select('status')
          .eq('id', jobId)
          .maybeSingle()

        if (current && current.status !== 'paused' && !TERMINAL_STATUSES.has(current.status)) {
          await supabase
            .from('article_jobs')
            .update({
              status: 'failed',
              pause_requested: false,
              completed_at: new Date().toISOString(),
              error_message: error.message,
            })
            .eq('id', jobId)
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
