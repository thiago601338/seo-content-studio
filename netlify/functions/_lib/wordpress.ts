export type WPSite = {
  base_url: string;
  wp_username: string;
  app_password: string;
};

function cleanUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function authHeader(site: WPSite) {
  return `Basic ${Buffer.from(`${site.wp_username}:${site.app_password}`).toString('base64')}`;
}

export async function wpFetch(site: WPSite, path: string, init: RequestInit = {}) {
  const response = await fetch(`${cleanUrl(site.base_url)}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      authorization: authHeader(site),
      ...(init.body && !(init.body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    let message = `WordPress retornou HTTP ${response.status}.`;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.message || message;
    } catch {
      if (body) message += ` ${body.slice(0, 500)}`;
    }
    throw new Error(message);
  }
  return response;
}

export async function getSiteMetadata(site: WPSite) {
  const [meResponse, categoriesResponse] = await Promise.all([
    wpFetch(site, '/wp-json/wp/v2/users/me?context=edit'),
    wpFetch(site, '/wp-json/wp/v2/categories?per_page=100&hide_empty=false&orderby=name&order=asc'),
  ]);
  const me = await meResponse.json() as any;
  const categories = await categoriesResponse.json() as any[];

  let authors: any[] = [];
  try {
    const response = await wpFetch(site, '/wp-json/wp/v2/users?context=edit&per_page=100&orderby=name&order=asc');
    authors = await response.json() as any[];
  } catch {
    authors = [me];
  }

  let connector: any = null;
  try {
    const response = await wpFetch(site, '/wp-json/ri-ai/v1/ping');
    connector = await response.json();
  } catch {
    connector = null;
  }

  return {
    current_user: { id: me.id, name: me.name, slug: me.slug },
    categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c.count })),
    authors: authors.map((u) => ({ id: u.id, name: u.name, slug: u.slug })),
    connector,
    synced_at: new Date().toISOString(),
  };
}

export async function uploadMedia(site: WPSite, image: Uint8Array, options: {
  filename: string;
  mime: string;
  title: string;
  alt: string;
  caption?: string;
}) {
  const response = await wpFetch(site, '/wp-json/wp/v2/media', {
    method: 'POST',
    headers: {
      'content-type': options.mime,
      'content-disposition': `attachment; filename="${options.filename.replace(/"/g, '')}"`,
    },
    body: image as any,
  });
  const media = await response.json() as any;

  const updated = await wpFetch(site, `/wp-json/wp/v2/media/${media.id}`, {
    method: 'POST',
    body: JSON.stringify({
      title: options.title,
      alt_text: options.alt,
      caption: options.caption || '',
    }),
  });
  return await updated.json() as any;
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export async function ensureTags(site: WPSite, tags: string[]) {
  const ids: number[] = [];
  for (const raw of tags.slice(0, 12)) {
    const name = raw.trim();
    if (!name) continue;
    const search = await wpFetch(site, `/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=100`);
    const found = await search.json() as any[];
    const exact = found.find((tag) => String(tag.name).toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (exact) {
      ids.push(exact.id);
      continue;
    }
    try {
      const created = await wpFetch(site, '/wp-json/wp/v2/tags', {
        method: 'POST',
        body: JSON.stringify({ name, slug: slugify(name) }),
      });
      const tag = await created.json() as any;
      ids.push(tag.id);
    } catch {
      // Uma corrida de criacao de tag nao deve derrubar o artigo.
      const retry = await wpFetch(site, `/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=100`);
      const list = await retry.json() as any[];
      const match = list.find((tag) => String(tag.name).toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
      if (match) ids.push(match.id);
    }
  }
  return Array.from(new Set(ids));
}

export async function listRecentPosts(site: WPSite, limit = 40) {
  const response = await wpFetch(site, `/wp-json/wp/v2/posts?per_page=${Math.min(100, limit)}&status=publish&_fields=id,link,title,slug,date`);
  const posts = await response.json() as any[];
  return posts.map((p) => ({
    id: p.id,
    url: p.link,
    title: p.title?.rendered || '',
    slug: p.slug,
    date: p.date,
  }));
}

export async function createPost(site: WPSite, payload: Record<string, unknown>) {
  try {
    const response = await wpFetch(site, '/wp-json/wp/v2/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await response.json() as any;
  } catch (error) {
    if (payload.meta) {
      const retryPayload = { ...payload };
      delete retryPayload.meta;
      const response = await wpFetch(site, '/wp-json/wp/v2/posts', {
        method: 'POST',
        body: JSON.stringify(retryPayload),
      });
      return await response.json() as any;
    }
    throw error;
  }
}
