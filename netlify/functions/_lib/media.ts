import { adminSupabase } from './supabase';

export type GeneratedMedia = {
  kind: 'cover' | 'body';
  slot: number;
  url: string;
  path: string;
  filename: string;
  mime: string;
  alt: string;
};

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'artigo';
}

export function mediaFilename(title: string, kind: 'cover' | 'body', slot: number, extension: string) {
  const suffix = kind === 'cover' ? 'capa' : `imagem-${slot}`;
  return `${slugify(title)}-${suffix}.${extension}`;
}

export async function storeGeneratedMedia(input: {
  userId: string;
  articleId: string;
  title: string;
  kind: 'cover' | 'body';
  slot: number;
  bytes: Uint8Array;
  mime: string;
  extension: string;
  alt: string;
}): Promise<GeneratedMedia> {
  const supabase = adminSupabase();
  const filename = mediaFilename(input.title, input.kind, input.slot, input.extension);
  const path = `${input.userId}/${input.articleId}/${filename}`;
  const { error } = await supabase.storage.from('article-media').upload(path, input.bytes, {
    contentType: input.mime,
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`Falha ao salvar imagem: ${error.message}`);
  const { data } = supabase.storage.from('article-media').getPublicUrl(path);
  if (!data.publicUrl) throw new Error('Nao foi possivel obter URL publica da imagem.');
  return {
    kind: input.kind,
    slot: input.slot,
    url: data.publicUrl,
    path,
    filename,
    mime: input.mime,
    alt: input.alt,
  };
}

export async function fetchMediaBytes(media: Pick<GeneratedMedia, 'url'>) {
  const response = await fetch(media.url);
  if (!response.ok) throw new Error(`Falha ao ler imagem gerada (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}
