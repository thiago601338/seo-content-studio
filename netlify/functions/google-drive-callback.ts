import { appUrl, completeDriveOAuth } from './_lib/drive';

export default async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error') || '';
  try {
    if (error) throw new Error(error);
    if (!code || !state) throw new Error('Retorno OAuth incompleto.');
    await completeDriveOAuth(code, state);
    return Response.redirect(`${appUrl()}/configuracoes?drive=connected`, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.redirect(`${appUrl()}/configuracoes?drive=error&message=${encodeURIComponent(message)}`, 302);
  }
};

export const config = { path: '/api/google-drive-callback' };
