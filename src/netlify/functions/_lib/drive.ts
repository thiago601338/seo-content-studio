import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto';
import type { GeneratedMedia } from './media';
import { adminSupabase } from './supabase';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const PROFILE_SCOPES = ['openid', 'email', 'profile'];

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ${name} nao configurada no Netlify.`);
  return value;
}

export function appUrl() {
  return required('APP_URL').replace(/\/+$/, '');
}

export function driveRedirectUri() {
  return `${appUrl()}/api/google-drive-callback`;
}

export async function createDriveAuthUrl(userId: string) {
  const supabase = adminSupabase();
  const state = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from('drive_oauth_states').delete().eq('user_id', userId);
  const { error } = await supabase.from('drive_oauth_states').insert({ state, user_id: userId, expires_at: expiresAt });
  if (error) throw error;
  const params = new URLSearchParams({
    client_id: required('GOOGLE_CLIENT_ID'),
    redirect_uri: driveRedirectUri(),
    response_type: 'code',
    scope: [...PROFILE_SCOPES, DRIVE_SCOPE].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Falha no OAuth do Google.');
  return data;
}

export async function completeDriveOAuth(code: string, state: string) {
  const supabase = adminSupabase();
  const { data: stateRow } = await supabase.from('drive_oauth_states').select('*').eq('state', state).maybeSingle();
  if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) throw new Error('Estado OAuth invalido ou expirado.');
  const tokens = await tokenRequest(new URLSearchParams({
    code,
    client_id: required('GOOGLE_CLIENT_ID'),
    client_secret: required('GOOGLE_CLIENT_SECRET'),
    redirect_uri: driveRedirectUri(),
    grant_type: 'authorization_code',
  }));
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = profileResponse.ok ? await profileResponse.json() as any : {};
  const existing = await supabase.from('drive_connections').select('*').eq('user_id', stateRow.user_id).maybeSingle();
  const refreshToken = tokens.refresh_token || (existing.data?.encrypted_refresh_token ? decryptSecret(existing.data.encrypted_refresh_token) : '');
  if (!refreshToken) throw new Error('Google nao forneceu refresh token. Remova o acesso do app na conta Google e conecte novamente.');
  const payload = {
    user_id: stateRow.user_id,
    email: profile.email || existing.data?.email || null,
    display_name: profile.name || existing.data?.display_name || null,
    encrypted_access_token: encryptSecret(tokens.access_token),
    encrypted_refresh_token: encryptSecret(refreshToken),
    token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
  };
  const { error } = await supabase.from('drive_connections').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
  await supabase.from('drive_oauth_states').delete().eq('state', state);
  return payload;
}

export async function getDriveConnection(userId: string) {
  const { data, error } = await adminSupabase().from('drive_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDriveAccessToken(userId: string) {
  const supabase = adminSupabase();
  const connection = await getDriveConnection(userId);
  if (!connection) throw new Error('Google Drive nao conectado.');
  if (connection.encrypted_access_token && connection.token_expires_at && new Date(connection.token_expires_at).getTime() > Date.now() + 90_000) {
    return { accessToken: decryptSecret(connection.encrypted_access_token), connection };
  }
  if (!connection.encrypted_refresh_token) throw new Error('Refresh token do Google Drive ausente.');
  const tokens = await tokenRequest(new URLSearchParams({
    client_id: required('GOOGLE_CLIENT_ID'),
    client_secret: required('GOOGLE_CLIENT_SECRET'),
    refresh_token: decryptSecret(connection.encrypted_refresh_token),
    grant_type: 'refresh_token',
  }));
  const accessToken = tokens.access_token as string;
  await supabase.from('drive_connections').update({
    encrypted_access_token: encryptSecret(accessToken),
    token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
  }).eq('user_id', userId);
  return { accessToken, connection };
}

function imageSize(media: GeneratedMedia, configured: string) {
  if (configured === '1024x1536') return media.kind === 'cover' ? { width: 360, height: 540 } : { width: 300, height: 450 };
  if (configured === '1024x1024') return media.kind === 'cover' ? { width: 440, height: 440 } : { width: 380, height: 380 };
  return media.kind === 'cover' ? { width: 500, height: 333 } : { width: 440, height: 293 };
}

function markerFor(media: GeneratedMedia) {
  return media.kind === 'cover' ? '[[RI_COVER]]' : `[[RI_MEDIA_${media.slot}]]`;
}

async function insertImagesIntoDoc(accessToken: string, documentId: string, media: GeneratedMedia[], configuredSize: string) {
  if (!media.length) return;
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return;
  const doc = await response.json() as any;
  const locations: Array<{ media: GeneratedMedia; start: number; end: number }> = [];
  for (const item of doc.body?.content || []) {
    for (const element of item.paragraph?.elements || []) {
      const text = String(element.textRun?.content || '');
      for (const mediaItem of media) {
        const marker = markerFor(mediaItem);
        const offset = text.indexOf(marker);
        if (offset >= 0) locations.push({ media: mediaItem, start: Number(element.startIndex || 1) + offset, end: Number(element.startIndex || 1) + offset + marker.length });
      }
    }
  }
  const found = new Set(locations.map((item) => markerFor(item.media)));
  locations.sort((a, b) => b.start - a.start);
  const requests: any[] = [];
  for (const item of locations) {
    const size = imageSize(item.media, configuredSize);
    requests.push({ deleteContentRange: { range: { startIndex: item.start, endIndex: item.end } } });
    requests.push({ insertInlineImage: { uri: item.media.url, location: { index: item.start }, objectSize: { width: { magnitude: size.width, unit: 'PT' }, height: { magnitude: size.height, unit: 'PT' } } } });
  }
  for (const mediaItem of media) {
    if (found.has(markerFor(mediaItem))) continue;
    const size = imageSize(mediaItem, configuredSize);
    requests.push({ insertInlineImage: { uri: mediaItem.url, endOfSegmentLocation: {}, objectSize: { width: { magnitude: size.width, unit: 'PT' }, height: { magnitude: size.height, unit: 'PT' } } } });
  }
  if (!requests.length) return;
  const update = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!update.ok) {
    const data = await update.json().catch(() => ({})) as any;
    throw new Error(data?.error?.message || 'Google Doc criado, mas nao foi possivel inserir as imagens.');
  }
}

export async function createGoogleDocFromHtml(userId: string, title: string, html: string, media: GeneratedMedia[], configuredSize: string) {
  const { accessToken, connection } = await getDriveAccessToken(userId);
  const boundary = `ri_${randomBytes(12).toString('hex')}`;
  const metadata: Record<string, unknown> = { name: title, mimeType: 'application/vnd.google-apps.document' };
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, Buffer.from(html, 'utf8'), tail]);
  const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const file = await createResponse.json() as any;
  if (!createResponse.ok) throw new Error(file?.error?.message || 'Falha ao criar Google Doc.');
  await insertImagesIntoDoc(accessToken, file.id, media, configuredSize);
  const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/permissions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  });
  if (!permissionResponse.ok) {
    const data = await permissionResponse.json().catch(() => ({})) as any;
    throw new Error(data?.error?.message || 'Documento criado, mas nao foi possivel liberar o compartilhamento publico.');
  }
  const getResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?fields=id,name,webViewLink`, { headers: { authorization: `Bearer ${accessToken}` } });
  const finalFile = getResponse.ok ? await getResponse.json() as any : file;
  return { id: file.id as string, url: finalFile.webViewLink || `https://docs.google.com/document/d/${file.id}/edit` };
}
