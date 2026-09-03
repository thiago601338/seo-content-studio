import type { WriterConfig } from './types';

export const MAX_BATCH = 120;
export const MAX_WORDS = 800;
export const MIN_WORDS = 300;

export const defaultWriterConfig: WriterConfig = {
  site_id: '',
  publish_to_wordpress: false,
  save_to_drive: false,
  word_count: 800,
  keyword_in_title: true,
  content_type: 'auto',
  search_intent: 'auto',
  tone: 'editorial',
  point_of_view: 'auto',
  target_country: 'Brasil',
  readability: 'standard',
  structure_depth: 'balanced',
  allow_h3: true,
  include_faq: false,
  include_takeaways: false,
  intro_hook: 'auto',
  web_research: false,
  reasoning_effort: 'low',
  model: 'gpt-5.6-terra',
  cover_image: true,
  body_images: 2,
  image_size: '1536x1024',
  image_quality: 'low',
  image_performance: 'fast',
  image_style: 'fotografia editorial realista',
  internal_links: 2,
  extra_links: [],
  include_conclusion: true,
  use_lists: true,
  use_tables: false,
  use_bold: true,
  category_id: '',
  author_id: '',
  publication_status: 'publish',
  schedule_start: '',
  interval_minutes: 0,
  sponsored: false,
  notes: '',
};

export function normalizeWriterConfig(raw?: Partial<WriterConfig> | null): WriterConfig {
  const saved = raw || {};
  const performance = saved.image_performance || 'fast';
  const publicationStatus = saved.publication_status === 'draft' ? 'publish' : (saved.publication_status || 'publish');
  return {
    ...defaultWriterConfig,
    ...saved,
    publication_status: publicationStatus,
    image_performance: performance,
    image_quality: saved.image_performance ? (saved.image_quality || defaultWriterConfig.image_quality) : 'low',
    word_count: Math.max(MIN_WORDS, Math.min(MAX_WORDS, Number(saved.word_count || defaultWriterConfig.word_count))),
    body_images: Math.max(0, Math.min(8, Number(saved.body_images ?? defaultWriterConfig.body_images))),
    internal_links: Math.max(0, Math.min(5, Number(saved.internal_links ?? defaultWriterConfig.internal_links))),
    interval_minutes: Math.max(0, Number(saved.interval_minutes || 0)),
    extra_links: Array.isArray(saved.extra_links) ? saved.extra_links.filter((item) => item && item.anchor && item.url) : [],
  };
}

export function readLocalWriterConfig(): WriterConfig {
  try {
    const raw = JSON.parse(localStorage.getItem('ri-writer-config') || '{}') as Partial<WriterConfig>;
    return normalizeWriterConfig(raw);
  } catch {
    return normalizeWriterConfig();
  }
}

export function profileSummary(config: Partial<WriterConfig>) {
  const normalized = normalizeWriterConfig(config);
  const destinations = [
    normalized.publish_to_wordpress ? 'WordPress' : '',
    normalized.save_to_drive ? 'Google Drive' : '',
  ].filter(Boolean);
  return {
    words: normalized.word_count,
    tone: normalized.tone,
    type: normalized.content_type,
    images: `${normalized.cover_image ? 'capa' : 'sem capa'} + ${normalized.body_images} interna(s)`,
    destinations: destinations.length ? destinations.join(' + ') : 'Somente Textos',
    model: normalized.model,
  };
}

export function toProfileConfig(config: WriterConfig, extraLinks?: WriterConfig['extra_links']): WriterConfig {
  return normalizeWriterConfig({
    ...config,
    extra_links: extraLinks ?? config.extra_links,
    // A data inicial e especifica de cada lote; guardar uma data antiga no perfil
    // poderia agendar uma nova rodada no momento errado. O intervalo permanece salvo.
    schedule_start: '',
  });
}
