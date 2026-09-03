import type { GeneratedMedia } from './media';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char] || char));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


export function sanitizeHeadingLinks(html: string) {
  return (html || '').replace(/<(h[1-6])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_full, tag: string, attrs: string = '', inner: string) => {
    const withoutAnchors = inner.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    const withoutVisibleUrls = withoutAnchors.replace(/https?:\/\/[^\s<]+/gi, '').replace(/\s{2,}/g, ' ').trim();
    return `<${tag}${attrs || ''}>${withoutVisibleUrls}</${tag}>`;
  });
}

export function buildDriveHtml(input: { title: string; html: string; excerpt?: string | null; media: GeneratedMedia[] }) {
  let body = sanitizeHeadingLinks(input.html || '');
  const bodyMedia = input.media.filter((item) => item.kind === 'body').sort((a, b) => a.slot - b.slot);
  for (const media of bodyMedia) {
    const marker = `[[RI_MEDIA_${media.slot}]]`;
    const url = escapeRegex(media.url);
    const figure = new RegExp(`<figure[^>]*>[\\s\\S]*?<img[^>]+src=["']${url}["'][^>]*>[\\s\\S]*?<\\/figure>`, 'i');
    const image = new RegExp(`<img[^>]+src=["']${url}["'][^>]*>`, 'i');
    if (figure.test(body)) body = body.replace(figure, `<p>${marker}</p>`);
    else if (image.test(body)) body = body.replace(image, `<p>${marker}</p>`);
    else body += `<p>${marker}</p>`;
  }
  const cover = input.media.find((item) => item.kind === 'cover');
  const coverMarker = cover ? '<p>[[RI_COVER]]</p>' : '';
  const excerpt = input.excerpt ? `<p><em>${escapeHtml(input.excerpt)}</em></p>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title></head><body><h1>${escapeHtml(input.title)}</h1>${coverMarker}${excerpt}${body}</body></html>`;
}
