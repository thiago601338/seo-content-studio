import { requireUser } from './_lib/auth';
import { createDriveAuthUrl } from './_lib/drive';
import { errorMessage, json } from './_lib/http';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    const user = await requireUser(req);
    return json({ url: await createDriveAuthUrl(user.id) });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config = { path: '/api/google-drive-auth-start' };
