import { userOrInternal } from './_lib/auth';
import { decryptSecret } from './_lib/crypto';
import { publishArticleToWordPress, saveArticleToDrive } from './_lib/destinations';
import { sanitizeHeadingLinks } from './_lib/document';
import { errorMessage, json, readJson } from './_lib/http';
import { generateImage, structuredResponse } from './_lib/openai';
import { storeGeneratedMedia, type GeneratedMedia } from './_lib/media';
import { articlePrompt, articleSchema, outlinePrompt, outlineSchema } from './_lib/prompts';
import { adminSupabase } from './_lib/supabase';
import { listRecentPosts } from './_lib/wordpress';

type GeneratedArticle = {
  title: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  tags: string[];
  category_id: number;
  body_html: string;
  cover_image_prompt: string;
  cover_image_alt: string;
  body_images: Array<{ slot: number; prompt: string; alt: string }>;
  internal_links: Array<{ url: string; anchor: string }>;
};

type GenerationPlan = {
  cover_image_prompt?: string;
  cover_image_alt?: string;
  body_images?: Array<{ slot: number; prompt: string; alt: string }>;
};

class ExecutionStopped extends Error {}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char] || char));
}

function injectAnchor(html: string, anchor: string, url: string) {
  if (!anchor || !url || html.includes(`href="${url}"`) || html.includes(`href='${url}'`)) return html;
  const parts = html.split(/(<[^>]+>)/g);
  let insideAnchor = 0;
  let insideHeading = 0;
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) insideAnchor += 1;
      if (/^<\/a\b/i.test(part)) insideAnchor = Math.max(0, insideAnchor - 1);
      if (/^<h[1-6]\b/i.test(part)) insideHeading += 1;
      if (/^<\/h[1-6]\b/i.test(part)) insideHeading = Math.max(0, insideHeading - 1);
      continue;
    }
    if (insideAnchor || insideHeading || !regex.test(part)) continue;
    parts[i] = part.replace(regex, (match) => `<a href="${escapeHtml(url)}">${match}</a>`);
    return parts.join('');
  }
  return html;
}

function imageFigure(url: string, alt: string) {
  return `<figure class="wp-block-image size-large"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" /></figure>`;
}

function htmlWordCount(html: string) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&[a-z0-9#]+;/gi, ' ');
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
}

function trimHtmlToWords(html: string, maxWords = 800) {
  if (htmlWordCount(html) <= maxWords) return html;
  const tokens = html.split(/(<[^>]+>)/g).filter(Boolean);
  const stack: string[] = [];
  const voidTags = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'source']);
  let words = 0;
  let out = '';
  let stopped = false;

  for (const token of tokens) {
    if (stopped) break;
    if (token.startsWith('<')) {
      out += token;
      const close = token.match(/^<\/\s*([a-z0-9]+)/i);
      const open = token.match(/^<\s*([a-z0-9]+)/i);
      if (close) {
        const tag = close[1].toLowerCase();
        const idx = stack.lastIndexOf(tag);
        if (idx >= 0) stack.splice(idx, 1);
      } else if (open && !token.endsWith('/>')) {
        const tag = open[1].toLowerCase();
        if (!voidTags.has(tag)) stack.push(tag);
      }
      continue;
    }

    for (const part of token.split(/(\s+)/)) {
      if (!part) continue;
      const count = (part.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
      if (count && words + count > maxWords) { stopped = true; break; }
      out += part;
      words += count;
    }
  }

  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

function mergeMedia(items: GeneratedMedia[], item: GeneratedMedia) {
  return [...items.filter((m) => !(m.kind === item.kind && m.slot === item.slot)), item];
}

async function kickNext(supabase: ReturnType<typeof adminSupabase>, count = 1) {
  const now = new Date().toISOString();
  const { data: rows } = await supabase.from('articles')
    .select('id')
    .eq('status', 'queued')
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(count);
  if (!rows?.length) return;
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.APP_URL || '';
  const secret = process.env.INTERNAL_DISPATCH_SECRET || '';
  if (!base || !secret) return;
  await Promise.allSettled(rows.map((row) => fetch(`${base.replace(/\/$/, '')}/api/process-article`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-dispatch-secret': secret },
    body: JSON.stringify({ article_id: row.id }),
  })));
}

async function progress(supabase: ReturnType<typeof adminSupabase>, id: string, runVersion: number, pct: number, label: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.from('articles')
    .update({ progress: pct, progress_label: label, ...extra })
    .eq('id', id)
    .eq('run_version', runVersion)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ExecutionStopped('Execucao pausada, cancelada ou substituida.');
}


type MediaTask = {
  kind: 'cover' | 'body';
  slot: number;
  prompt: string;
  alt: string;
};

function cleanPrompt(value: string, max = 480) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function mediaPerformance(cfg: any) {
  const mode = ['fast', 'balanced', 'quality'].includes(cfg.image_performance) ? cfg.image_performance : 'fast';
  return {
    mode,
    fast: mode === 'fast',
    quality: mode === 'fast' ? 'low' : mode === 'quality' ? 'high' : (cfg.image_quality || 'medium'),
    parallelism: mode === 'quality' ? 1 : 2,
    compression: mode === 'fast' ? 78 : mode === 'balanced' ? 84 : 90,
  };
}

function taskPrompt(base: string, fallback: string, style: string, fast: boolean) {
  const subject = cleanPrompt(base || fallback, fast ? 360 : 1200) || fallback;
  if (fast) return `${subject}. Estilo: ${cleanPrompt(style, 120)}. Composicao simples e limpa, foco claro no assunto, sem texto, sem logotipos, sem marcas d'agua.`;
  return `${subject}\nEstilo solicitado: ${style}. Sem texto sobreposto, sem marcas d'agua.`;
}

async function withImageHeartbeat<T>(
  promise: Promise<T>,
  supabase: ReturnType<typeof adminSupabase>,
  id: string,
  runVersion: number,
  pct: number,
  label: string,
) {
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += 10;
    const visualPct = Math.min(pct + 4, pct + Math.floor(elapsed / 15));
    void progress(supabase, id, runVersion, visualPct, `${label} · IA trabalhando (${elapsed}s)`).catch(() => null);
  }, 10000);
  try {
    return await promise;
  } finally {
    clearInterval(timer);
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  const supabase = adminSupabase();
  let articleId = '';
  let claimedRunVersion = 0;

  try {
    const access = await userOrInternal(req);
    const body = await readJson<{ article_id: string }>(req);
    articleId = body.article_id;
    if (!articleId) return json({ error: 'article_id obrigatorio.' }, 422);

    const { data: existing, error: loadError } = await supabase.from('articles').select('*').eq('id', articleId).single();
    if (loadError || !existing) return json({ error: 'Artigo nao encontrado.' }, 404);
    if (!access.internal && existing.user_id !== access.user?.id) return json({ error: 'Acesso negado.' }, 403);
    if (!['queued', 'error'].includes(existing.status)) return json({ ok: true, skipped: true, status: existing.status });

    const nextRunVersion = Number(existing.run_version || 0) + 1;
    const { data: article, error: claimError } = await supabase.from('articles').update({
      status: 'processing',
      progress: Math.max(4, Number(existing.progress || 0)),
      progress_label: existing.generated_html ? 'Retomando geracao' : 'Preparando geracao',
      error: null,
      run_version: nextRunVersion,
      paused_at: null,
    }).eq('id', articleId).eq('status', existing.status).eq('run_version', Number(existing.run_version || 0)).select('*').maybeSingle();
    if (claimError) throw claimError;
    if (!article) return json({ ok: true, skipped: true, reason: 'Ja processado por outra execucao.' });

    claimedRunVersion = Number(article.run_version || nextRunVersion);
    const cfg = { ...(article.config || {}), word_count: Math.max(300, Math.min(800, Number(article.config?.word_count || 800))) };
    const publishToWp = Boolean(article.publish_to_wordpress ?? cfg.publish_to_wordpress);
    const saveToDrive = Boolean(article.save_to_drive ?? cfg.save_to_drive);
    let categories: any[] = [];
    let recentPosts: Array<{ url: string; title: string }> = [];

    if (article.site_id) {
      const siteResult = await supabase.from('sites').select('*').eq('id', article.site_id).eq('user_id', article.user_id).maybeSingle();
      const site = siteResult.data;
      categories = Array.isArray(site?.metadata?.categories) ? site.metadata.categories : [];
      if (site && Number(cfg.internal_links || 0) > 0 && !article.generated_html) {
        await progress(supabase, articleId, claimedRunVersion, 9, 'Analisando links internos');
        const secretResult = await supabase.from('site_secrets').select('*').eq('site_id', site.id).maybeSingle();
        if (secretResult.data) {
          try {
            recentPosts = await listRecentPosts({
              base_url: site.base_url,
              wp_username: site.wp_username,
              app_password: decryptSecret(secretResult.data.encrypted_app_password),
            }, 50);
          } catch {
            recentPosts = [];
          }
        }
      }
    }

    let materialized: any = { ...article, config: cfg };

    const hasApprovedOutline = Array.isArray(materialized.outline?.headings) && materialized.outline.headings.length > 0;
    if (!hasApprovedOutline && !materialized.generated_html) {
      await progress(supabase, articleId, claimedRunVersion, 12, 'Planejando titulo e headings');
      const outlineRequest = outlinePrompt({
        keyword: materialized.keyword || '',
        targetUrl: materialized.target_url || '',
        requestedTitle: materialized.requested_title || '',
        topic: materialized.topic || '',
        supportKeywords: materialized.support_keywords || [],
        wordCount: cfg.word_count,
        keywordInTitle: cfg.keyword_in_title !== false,
        contentType: cfg.content_type,
        searchIntent: cfg.search_intent,
        tone: cfg.tone,
        pointOfView: cfg.point_of_view,
        targetCountry: cfg.target_country,
        readability: cfg.readability,
        structureDepth: cfg.structure_depth,
        allowH3: cfg.allow_h3,
        includeFaq: cfg.include_faq,
        includeTakeaways: cfg.include_takeaways,
        introHook: cfg.intro_hook,
        notes: cfg.notes,
      });
      const automaticOutline = await structuredResponse<any>({
        instructions: outlineRequest.instructions,
        input: outlineRequest.user,
        schemaName: 'content_outline',
        schema: outlineSchema,
        webResearch: Boolean(cfg.web_research),
        reasoningEffort: cfg.reasoning_effort || 'low',
        model: cfg.model || undefined,
      });
      const autoTopic = materialized.topic || automaticOutline.suggested_topic || '';
      await progress(supabase, articleId, claimedRunVersion, 18, 'Estrutura pronta', {
        outline: automaticOutline,
        topic: autoTopic,
      });
      materialized = { ...materialized, outline: automaticOutline, topic: autoTopic };
    }

    if (!materialized.generated_html || !materialized.generated_title) {
      await progress(supabase, articleId, claimedRunVersion, 22, 'Gerando texto e SEO');
      const prompt = articlePrompt({
        keyword: materialized.keyword || '',
        targetUrl: materialized.target_url || '',
        title: materialized.requested_title || materialized.outline?.title || '',
        topic: materialized.topic || materialized.outline?.suggested_topic || '',
        supportKeywords: materialized.support_keywords || materialized.outline?.support_keywords || [],
        outline: materialized.outline || {},
        config: cfg,
        categories,
        recentPosts,
      });

      const generated = await structuredResponse<GeneratedArticle>({
        instructions: prompt.instructions,
        input: prompt.user,
        schemaName: 'content_article',
        schema: articleSchema,
        webResearch: Boolean(cfg.web_research),
        reasoningEffort: cfg.reasoning_effort || 'low',
        model: cfg.model || undefined,
      });

      let html = trimHtmlToWords(sanitizeHeadingLinks(generated.body_html || ''), 800);
      if (article.keyword && article.target_url) html = injectAnchor(html, article.keyword, article.target_url);
      for (const pair of Array.isArray(cfg.extra_links) ? cfg.extra_links : []) {
        if (pair?.anchor && pair?.url) html = injectAnchor(html, String(pair.anchor), String(pair.url));
      }
      for (const pair of generated.internal_links || []) {
        if (pair?.anchor && pair?.url) html = injectAnchor(html, pair.anchor, pair.url);
      }

      const generationPlan: GenerationPlan = {
        cover_image_prompt: generated.cover_image_prompt,
        cover_image_alt: generated.cover_image_alt,
        body_images: generated.body_images || [],
      };

      await progress(supabase, articleId, claimedRunVersion, 34, 'Texto concluido', {
        generated_title: generated.title,
        generated_html: html,
        excerpt: generated.excerpt,
        seo_title: generated.seo_title,
        seo_description: generated.seo_description,
        generated_tags: generated.tags || [],
        generation_plan: generationPlan,
      });

      materialized = {
        ...materialized,
        generated_title: generated.title,
        generated_html: html,
        excerpt: generated.excerpt,
        seo_title: generated.seo_title,
        seo_description: generated.seo_description,
        generated_tags: generated.tags || [],
        generation_plan: generationPlan,
      };
    }

    const plan = (materialized.generation_plan || {}) as GenerationPlan;
    let generatedMedia = (Array.isArray(materialized.generated_media) ? materialized.generated_media : []) as GeneratedMedia[];
    let html = sanitizeHeadingLinks(materialized.generated_html || '');
    let coverUrl = materialized.cover_image_url || null;

    const requestedImages = Math.max(0, Math.min(8, Number(cfg.body_images || 0)));
    const plannedImages = [...(plan.body_images || [])].sort((a, b) => a.slot - b.slot);
    const perf = mediaPerformance(cfg);
    const imageStyle = cfg.image_style || 'fotografia editorial realista';
    const imageSize = cfg.image_size || '1536x1024';
    const mediaTasks: MediaTask[] = [];

    if (cfg.cover_image !== false && !coverUrl) {
      const fallback = `Capa editorial sobre ${materialized.generated_title || article.keyword || article.topic || 'o tema do artigo'}`;
      mediaTasks.push({
        kind: 'cover',
        slot: 0,
        prompt: taskPrompt(plan.cover_image_prompt || '', fallback, imageStyle, perf.fast),
        alt: plan.cover_image_alt || article.keyword || materialized.generated_title || '',
      });
    }

    for (let slot = 1; slot <= requestedImages; slot += 1) {
      if (generatedMedia.some((m) => m.kind === 'body' && m.slot === slot)) continue;
      const imgPlan = plannedImages.find((item) => Number(item.slot) === slot);
      const heading = Array.isArray(materialized.outline?.headings) ? materialized.outline.headings[slot - 1]?.text : '';
      const fallback = `Imagem editorial sobre ${heading || materialized.generated_title || article.keyword || 'o tema do artigo'}`;
      mediaTasks.push({
        kind: 'body',
        slot,
        prompt: taskPrompt(imgPlan?.prompt || '', fallback, imageStyle, perf.fast),
        alt: imgPlan?.alt || `${article.keyword || materialized.generated_title || 'Artigo'} - imagem ${slot}`,
      });
    }

    if (mediaTasks.length) {
      const modeLabel = perf.fast ? 'modo rapido' : perf.mode === 'balanced' ? 'modo equilibrado' : 'qualidade maxima';
      let done = 0;
      await progress(supabase, articleId, claimedRunVersion, 42, `Gerando ${mediaTasks.length} imagem(ns) · ${modeLabel}`);

      for (let index = 0; index < mediaTasks.length; index += perf.parallelism) {
        const batch = mediaTasks.slice(index, index + perf.parallelism);
        const startPct = 43 + Math.round((done / mediaTasks.length) * 26);
        const label = batch.length > 1
          ? `Gerando ${done + 1}-${done + batch.length} de ${mediaTasks.length} imagens em paralelo`
          : `Gerando imagem ${done + 1} de ${mediaTasks.length}`;
        await progress(supabase, articleId, claimedRunVersion, startPct, label);

        const storedBatch = await withImageHeartbeat(Promise.all(batch.map(async (task) => {
          const image = await generateImage({
            prompt: task.prompt,
            size: imageSize,
            quality: perf.quality,
            outputFormat: 'jpeg',
            compression: perf.compression,
          });
          return storeGeneratedMedia({
            userId: article.user_id,
            articleId,
            title: materialized.generated_title || article.keyword || 'Artigo',
            kind: task.kind,
            slot: task.slot,
            bytes: image.bytes,
            mime: image.mime,
            extension: image.extension,
            alt: task.alt,
          });
        })), supabase, articleId, claimedRunVersion, startPct, label);

        for (const stored of storedBatch) {
          generatedMedia = mergeMedia(generatedMedia, stored);
          if (stored.kind === 'cover') {
            coverUrl = stored.url;
            continue;
          }
          const marker = `[[IMAGE_${stored.slot}]]`;
          const figure = imageFigure(stored.url, stored.alt || materialized.generated_title || '');
          if (!html.includes(stored.url)) html = html.includes(marker) ? html.replace(marker, figure) : `${html}\n${figure}`;
        }
        done += storedBatch.length;
        const donePct = 46 + Math.round((done / mediaTasks.length) * 27);
        await progress(supabase, articleId, claimedRunVersion, Math.min(73, donePct), `${done} de ${mediaTasks.length} imagem(ns) pronta(s)`, {
          generated_media: generatedMedia,
          generated_html: html,
          cover_image_url: coverUrl,
        });
        materialized = { ...materialized, generated_media: generatedMedia, generated_html: html, cover_image_url: coverUrl };
      }
    }

    html = html.replace(/\[\[IMAGE_\d+\]\]/g, '');
    await progress(supabase, articleId, claimedRunVersion, 78, mediaTasks.length ? 'Texto e imagens prontos' : 'Texto pronto · sem imagens pendentes', {
      generated_html: html,
      generated_media: generatedMedia,
      cover_image_url: coverUrl,
    });
    materialized = { ...materialized, generated_html: html, generated_media: generatedMedia, cover_image_url: coverUrl };

    if (saveToDrive && !materialized.drive_doc_url) {
      await progress(supabase, articleId, claimedRunVersion, 84, 'Criando Google Doc');
      const drive = await saveArticleToDrive(materialized);
      materialized = { ...materialized, drive_file_id: drive.id, drive_doc_url: drive.url };
    }

    if (publishToWp && !materialized.wp_post_url) {
      if (!materialized.site_id) throw new Error('Publicacao no WordPress ativada, mas nenhum site foi selecionado.');
      await progress(supabase, articleId, claimedRunVersion, saveToDrive ? 93 : 88, 'Publicando no WordPress');
      const wp = await publishArticleToWordPress(materialized);
      materialized = { ...materialized, wp_post_id: wp.id, wp_post_url: wp.url };
    }

    const destinationLabel = publishToWp && saveToDrive ? 'Texto, Drive e WordPress concluidos' : publishToWp ? 'Texto e WordPress concluidos' : saveToDrive ? 'Texto e Google Drive concluidos' : 'Texto salvo';
    await progress(supabase, articleId, claimedRunVersion, 100, destinationLabel, { status: 'completed', error: null });
    await kickNext(supabase, 1);
    return json({ ok: true, article_id: articleId, wp_post_url: materialized.wp_post_url || null, drive_doc_url: materialized.drive_doc_url || null });
  } catch (error) {
    if (error instanceof ExecutionStopped) {
      await kickNext(supabase, 1);
      return json({ ok: true, stopped: true });
    }
    if (articleId) {
      const { data: current } = await supabase.from('articles').select('status, run_version').eq('id', articleId).maybeSingle();
      if (current && !['paused', 'cancelled'].includes(current.status)) {
        await supabase.from('articles').update({ status: 'error', progress_label: 'Erro', error: errorMessage(error).slice(0, 2000) }).eq('id', articleId).eq('run_version', claimedRunVersion || Number(current.run_version || 0));
      }
    }
    await kickNext(supabase, 1);
    return json({ error: errorMessage(error) }, 500);
  }
};

