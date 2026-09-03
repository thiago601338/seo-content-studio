import { requireUser } from './_lib/auth';
import { errorMessage, json } from './_lib/http';
import { adminSupabase } from './_lib/supabase';

export default async (req: Request) => {
  if (req.method !== 'DELETE') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    const supabase = adminSupabase();
    const { error } = await supabase.from('drive_connections').delete().eq('user_id', user.id);
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config = { path: '/api/google-drive-settings' };
