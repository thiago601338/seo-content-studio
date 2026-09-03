import { decryptSecret } from './crypto';
import { buildDriveHtml } from './document';
import { createGoogleDocFromHtml } from './drive';
import type { GeneratedMedia } from './media';
import { fetchMediaBytes } from './media';
import { adminSupabase } from './supabase';
import { createPost, ensureTags, uploadMedia } from './wordpress';

function replaceMediaUrls(html: string, replacements: Map<string, string>) {
  let output = html;
  for (const [from, to] of replacements) output = output.split(from).join(to);
  return output;
}

export async function saveArticleToDrive(article: any) {
  const supabase = adminSupabase();
  if (article.drive_doc_url) return { id: article.drive_file_id, url: article.drive_doc_url };
  const media = (Array.isArray(article.generated_media) ? article.generated_media : []) as GeneratedMedia[];
  const title = article.generated_title || article.requested_title || article.keyword || 'Artigo';
  const driveHtml = buildDriveHtml({ title, html: article.generated_html || '', excerpt: article.excerpt || '', media });
  const drive = await createGoogleDocFromHtml(article.user_id, title, driveHtml, media, article.config?.image_size || '1536x1024');
  await supabase.from('articles').update({ drive_file_id: drive.id, drive_doc_url: drive.url }).eq('id', article.id);
  return drive;
}

export async function publishArticleToWordPress(article: any, requestedSiteId?: string) {
  const supabase = adminSupabase();
  const siteId = requestedSiteId || article.site_id;
  if (!siteId) throw new Error('Selecione um site WordPress para publicar.');
  const { data: site, error: siteError } = await supabase.from('sites').select('*').eq('id', siteId).eq('user_id', article.user_id).single();
  if (siteError || !site) throw new Error('Site WordPress nao encontrado.');
  const { data: secret, error: secretError } = await supabase.from('site_secrets').select('*').eq('site_id', site.id).single();
  if (secretError || !secret) throw new Error('Credencial do WordPress nao encontrada.');
  const wpSite = { base_url: site.base_url, wp_username: site.wp_username, app_password: decryptSecret(secret.encrypted_app_password) };
  const cfg = article.config || {};
  const categories = Array.isArray(site.metadata?.categories) ? site.metadata.categories : [];
  const media = (Array.isArray(article.generated_media) ? article.generated_media : []) as GeneratedMedia[];
  const replacements = new Map<string, string>();
  let featuredMediaId = 0;

  for (const item of media) {
    const bytes = await fetchMediaBytes(item);
    const uploaded = await uploadMedia(wpSite, bytes, {
      filename: item.filename,
      mime: item.mime,
      title: item.kind === 'cover' ? (article.generated_title || 'Capa') : `${article.generated_title || 'Artigo'} - imagem ${item.slot}`,
      alt: item.alt || article.keyword || article.generated_title || '',
    });
    if (item.kind === 'cover') featuredMediaId = uploaded.id;
    else if (item.url && uploaded.source_url) replacements.set(item.url, uploaded.source_url);
  }

  const html = replaceMediaUrls(article.generated_html || '', replacements);
  const tagIds = await ensureTags(wpSite, Array.isArray(article.generated_tags) ? article.generated_tags : []);
  const availableCategoryIds = categories.map((c: any) => Number(c.id));
  let categoryId = Number(cfg.category_id || 0) || Number(site.default_category_id || 0);
  if (categoryId && availableCategoryIds.length && !availableCategoryIds.includes(categoryId)) categoryId = Number(site.default_category_id || availableCategoryIds[0] || 0);
  if (!categoryId && availableCategoryIds.length) categoryId = availableCategoryIds[0];

  let wpStatus = String(cfg.publication_status || 'draft');
  if (wpStatus === 'review') wpStatus = 'pending';
  if (!['draft', 'pending', 'publish', 'private'].includes(wpStatus)) wpStatus = 'draft';
  const scheduled = article.scheduled_at ? new Date(article.scheduled_at) : null;
  const inFuture = scheduled && scheduled.getTime() > Date.now() + 60_000;
  if (inFuture && wpStatus === 'publish') wpStatus = 'future';

  const payload: Record<string, unknown> = {
    title: article.generated_title || article.requested_title || article.keyword || 'Artigo',
    content: html,
    excerpt: article.excerpt || '',
    status: wpStatus,
    categories: categoryId ? [categoryId] : [],
    tags: tagIds,
    featured_media: featuredMediaId || 0,
    meta: { _ri_seo_title: article.seo_title || '', _ri_seo_description: article.seo_description || '', _ri_sponsored: Boolean(cfg.sponsored) },
  };
  const authorId = Number(cfg.author_id || site.default_author_id || 0);
  if (authorId) payload.author = authorId;
  if (inFuture && scheduled) payload.date_gmt = scheduled.toISOString().replace(/\.\d{3}Z$/, '');

  const post = await createPost(wpSite, payload);
  await supabase.from('articles').update({ site_id: siteId, wp_post_id: post.id, wp_post_url: post.link || site.base_url, wp_featured_media_id: featuredMediaId || null }).eq('id', article.id);
  return { id: post.id as number, url: (post.link || site.base_url) as string };
}
