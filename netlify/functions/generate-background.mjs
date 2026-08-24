import { randomUUID } from 'node:crypto'
import { assertAuthorized, parseJson } from './_lib/http.mjs'
import { getSupabaseAdmin } from './_lib/supabase.mjs'
import { countWords, generateCoverImage, generateSeoArticle, slugify, stripHtml } from './_lib/seo.mjs'

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

    if (job.status !== 'queued') return

    await supabase
      .from('article_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString(), error_message: null })
      .eq('id', jobId)

    const titles = []
    let completed = 0
    let failed = 0
    const errors = []

    for (let index = 1; index <= job.quantity; index += 1) {
      try {
        const article = await generateSeoArticle({
          keyword: job.keyword,
          linkUrl: job.link_url,
          keywordInTitle: job.keyword_in_title,
          index,
          quantity: job.quantity,
          previousTitles: titles,
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
