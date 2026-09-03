import { requireUser } from './_lib/auth';
import { getDriveConnection } from './_lib/drive';
import { errorMessage, json } from './_lib/http';

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    const connection = await getDriveConnection(user.id);
    return json({ connected: Boolean(connection), email: connection?.email || null, display_name: connection?.display_name || null });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config = { path: '/api/google-drive-status' };
