export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('A requisicao precisa usar application/json.');
  }
  return (await req.json()) as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Erro desconhecido');
}
