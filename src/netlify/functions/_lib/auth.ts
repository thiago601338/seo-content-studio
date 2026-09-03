import { adminSupabase } from './supabase';

export async function requireUser(req: Request) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('Sessao ausente. Entre novamente.');

  const supabase = adminSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Sessao invalida ou expirada.');
  return data.user;
}

export async function userOrInternal(req: Request) {
  const internal = req.headers.get('x-internal-dispatch-secret') || '';
  const expected = process.env.INTERNAL_DISPATCH_SECRET || '';
  if (expected && internal && internal === expected) {
    return { internal: true as const, user: null };
  }
  const user = await requireUser(req);
  return { internal: false as const, user };
}
