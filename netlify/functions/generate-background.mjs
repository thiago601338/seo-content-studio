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

export default async (req) => {
  let jobId = null
  const supabase = getSupabaseAdmin()

  try {
    assertAuthorized(req)
    const body = await parseJson(req)
    jobId = body.jobId
    if (!jobId) throw new Error('jobId não informado.')

    const { data: job, error: jobError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    if (jobError) throw jobError

    if (TERMINAL_STATUSES.has(job.status)) return
    if (!['queued', 'processing'].includes(job.status)) return

    if (job.status === 'queued') {
      await supabase
        .from('article_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString(), error_message: null })
        .eq('id', jobId)
    }

    // Um lote de até 120 textos é dividido em blocos menores. Isso evita manter
    // uma única Background Function do Netlify aberta durante todo o lote.
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
      try {
        const article = await generateSeoArticle({
          keyword: job.keyword,
          linkUrl: job.link_url,
          keywordInTitle: job.keyword_in_title,
          index,
          quantity: job.quantity,
          previousTitles: titles.slice(-12),
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

      await supabase
        .from('article_jobs')
        .update({
          completed_count: completed,
          failed_count: failed,
          error_message: errors.length ? errors.slice(-5).join('\n') : null,
        })
        .eq('id', jobId)
    }

    const processed = completed + failed
    if (processed < job.quantity) {
      await continueJob(req, jobId)
      return
    }

    const status = completed === 0 ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed'
    await supabase
      .from('article_jobs')
      .update({
        status,
        completed_count: completed,
        failed_count: failed,
        completed_at: new Date().toISOString(),
        error_message: errors.length ? errors.slice(-5).join('\n') : null,
      })
      .eq('id', jobId)
  } catch (error) {
    console.error('Background generation failed:', error)
    if (jobId) {
      await supabase
        .from('article_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq('id', jobId)
    }
  }
}

export const config = {
  path: '/api/generate-background',
  background: true,
}
